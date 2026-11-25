import type { OperationSdk, OperationSdkParamKind } from "@/lib/api/operations.gen";
import type { RequestMeta } from "@/lib/api/request-meta";

import { SDK_PACKAGES } from "@/lib/api/operations.gen";
import { cliOf, curlOf, operationOf, pathParamsOf } from "@/lib/api/request-meta";

/** The forms the request panel writes a request in (the Response view is not one: it is no request). */
export type SnippetFormat = "cli" | "curl" | "python" | "typescript";

export const SNIPPET_FORMATS: ReadonlyArray<{ label: string; value: SnippetFormat }> = [
    { label: "curl", value: "curl" },
    { label: "CLI", value: "cli" },
    { label: "Python", value: "python" },
    { label: "TypeScript", value: "typescript" },
];

export const snippetFormatLabel = (format: SnippetFormat) => SNIPPET_FORMATS.find(item => item.value === format)?.label ?? format;

type SdkArgument = { kind: "body"; model: string; name: string; value: unknown } | { kind: OperationSdkParamKind; name: string; value: string };

type SdkCall = { arguments: Array<SdkArgument>; className: string; method: string; models: Array<string> };

/** The SDK call of a request in one language (null when the SDK has no such operation). */
function sdkCallOf(meta: RequestMeta, language: "py" | "ts"): null | SdkCall {
    const operation = operationOf(meta.operationId);

    const sdk: null | OperationSdk | undefined = operation?.sdk;

    if (!operation || !sdk) return null;

    const values: Record<string, Array<string> | string> = { ...pathParamsOf(operation.path, meta.path), ...meta.query };

    const args: Array<SdkArgument> = Object.entries(values).map(([wire, value]) => {
        const names = Object.hasOwn(sdk.params, wire) ? sdk.params[wire] : null;

        const text = Array.isArray(value) ? value.join(",") : value;

        // A parameter the operation does not declare (none is sent): written under its wire name, as a string.
        return { kind: names?.kind ?? "string", name: names ? names[language] : wire, value: text };
    });

    const models: Array<string> = [];

    if (sdk.body && meta.body !== undefined) {
        args.push({ kind: "body", model: sdk.body.model, name: sdk.body[language], value: meta.body });

        models.push(sdk.body.model);
    }

    return { arguments: args, className: sdk.className, method: sdk[language], models };
}

const isNumeric = (text: string) => /^-?\d+(\.\d+)?$/.test(text);

/** A JSON value as a Python literal (`true` → `True`, `null` → `None`); strings as JSON strings (valid Python). */
export function pythonLiteral(value: unknown, indent = ""): string {
    if (value === null || value === undefined) return "None";

    if (value === true) return "True";

    if (value === false) return "False";

    if (typeof value === "number" || typeof value === "string") return JSON.stringify(value);

    const inner = `${indent}    `;

    if (Array.isArray(value)) {
        if (value.length === 0) return "[]";

        return `[\n${value.map(item => `${inner}${pythonLiteral(item, inner)}`).join(",\n")},\n${indent}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) return "{}";

    return `{\n${entries.map(([key, item]) => `${inner}${JSON.stringify(key)}: ${pythonLiteral(item, inner)}`).join(",\n")},\n${indent}}`;
}

function pythonValue(argument: SdkArgument, indent: string): string {
    switch (argument.kind) {
        case "body": return `${argument.model}.from_dict(${pythonLiteral(argument.value, indent)})`;
        case "boolean": return argument.value === "true" ? "True" : "False";
        case "date": return `date.fromisoformat(${JSON.stringify(argument.value)})`;
        // Python 3.10's `fromisoformat` reads no `Z`.
        case "datetime": return `datetime.fromisoformat(${JSON.stringify(argument.value.replace(/Z$/, "+00:00"))})`;
        case "number": return isNumeric(argument.value) ? argument.value : JSON.stringify(argument.value);
        default: return JSON.stringify(argument.value);
    }
}

function typescriptValue(argument: SdkArgument, indent: string): string {
    switch (argument.kind) {
        case "body": return `${argument.model}FromJSON(${JSON.stringify(argument.value, null, 4).replaceAll("\n", `\n${indent}`)})`;
        case "boolean": return argument.value === "true" ? "true" : "false";
        case "date":
        case "datetime": return `new Date(${JSON.stringify(argument.value)})`;
        case "number": return isNumeric(argument.value) ? argument.value : JSON.stringify(argument.value);
        default: return JSON.stringify(argument.value);
    }
}

const TS_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const unique = (items: Array<string>) => [...new Set(items)].sort();

const hostOf = (baseUrl: string) => JSON.stringify(baseUrl.replace(/\/+$/, ""));

/**
 * The Python SDK (`invinite-data-api`) code of one or more requests: one client, one call per request, each answer
 * printed. The key is ALWAYS read from `INVINITE_API_KEY`, never written out. A request the SDK has no operation for
 * is a comment.
 */
export function pythonOf(baseUrl: string, metas: ReadonlyArray<RequestMeta>): string {
    const calls = metas.map(meta => ({ call: sdkCallOf(meta, "py"), meta }));

    const known = calls.flatMap(({ call }) => (call ? [call] : []));

    const kinds = new Set(known.flatMap(call => call.arguments.map(argument => argument.kind)));

    const datetimeImports = unique([...(kinds.has("date") ? ["date"] : []), ...(kinds.has("datetime") ? ["datetime"] : [])]);

    const names = unique(["ApiClient", "Configuration", ...known.map(call => call.className), ...known.flatMap(call => call.models)]);

    const indent = "    ";

    const body = calls.map(({ call, meta }) => {
        if (!call) return `${indent}# ${meta.method} ${meta.path}: not in the SDK`;

        const args = call.arguments.map(argument => `${indent}${indent}${argument.name}=${pythonValue(argument, `${indent}${indent}`)},`);

        const invocation = args.length === 0
            ? `${call.className}(client).${call.method}()`
            : `${call.className}(client).${call.method}(\n${args.join("\n")}\n${indent})`;

        return `${indent}response = ${invocation}\n${indent}print(response)`;
    });

    const configuration = `configuration = Configuration(\n    host=${hostOf(baseUrl)},\n    access_token=os.environ["INVINITE_API_KEY"],\n)`;

    return [
        "import os",
        ...(datetimeImports.length > 0 ? [`from datetime import ${datetimeImports.join(", ")}`] : []),
        "",
        `from ${SDK_PACKAGES.pythonImport} import ${names.join(", ")}`,
        "",
        configuration,
        "",
        "with ApiClient(configuration) as client:",
        body.join("\n\n"),
    ].join("\n");
}

/**
 * The TypeScript SDK (`@invinite-org/data-api-client`) code of one or more requests: one configuration, one awaited
 * call per request (ES module top-level `await`), each answer logged. The key is ALWAYS `process.env.INVINITE_API_KEY`.
 */
export function typescriptOf(baseUrl: string, metas: ReadonlyArray<RequestMeta>): string {
    const calls = metas.map(meta => ({ call: sdkCallOf(meta, "ts"), meta }));

    const known = calls.flatMap(({ call }) => (call ? [call] : []));

    const names = unique(["Configuration", ...known.map(call => call.className), ...known.flatMap(call => call.models.map(model => `${model}FromJSON`))]);

    const indent = "    ";

    const body = calls.map(({ call, meta }, index) => {
        if (!call) return `// ${meta.method} ${meta.path}: not in the SDK`;

        const variable = calls.length === 1 ? "response" : `response${index + 1}`;

        const args = call.arguments.map((argument) => {
            const key = TS_IDENTIFIER.test(argument.name) ? argument.name : JSON.stringify(argument.name);

            return `${indent}${key}: ${typescriptValue(argument, indent)},`;
        });

        const invocation = args.length === 0
            ? `new ${call.className}(configuration).${call.method}()`
            : `new ${call.className}(configuration).${call.method}({\n${args.join("\n")}\n})`;

        return `const ${variable} = await ${invocation};\n\nconsole.log(${variable});`;
    });

    const configuration = `const configuration = new Configuration({\n    accessToken: process.env.INVINITE_API_KEY,\n    basePath: ${hostOf(baseUrl)},\n});`;

    return [
        `import { ${names.join(", ")} } from "${SDK_PACKAGES.npm}";`,
        "",
        configuration,
        "",
        body.join("\n\n"),
    ].join("\n");
}

/** Whether a request can be written in a format (CLI: an `x-cli` entry; SDKs: an SDK operation). */
export function hasSnippet(meta: RequestMeta, format: SnippetFormat): boolean {
    if (format === "curl") return true;

    if (format === "cli") return cliOf(meta) !== null;

    return Boolean(operationOf(meta.operationId)?.sdk);
}

/**
 * One or more requests in a format. curl / CLI = one line per request (a request without a CLI command is a `#`
 * comment); Python / TypeScript = one program with every call.
 */
export function snippetOf(format: SnippetFormat, baseUrl: string, metas: ReadonlyArray<RequestMeta>): string {
    switch (format) {
        case "cli": return metas.map(meta => cliOf(meta) ?? `# ${meta.method} ${meta.path}: no CLI command`).join("\n");
        case "python": return pythonOf(baseUrl, metas);
        case "typescript": return typescriptOf(baseUrl, metas);
        default: return metas.map(meta => curlOf(baseUrl, meta)).join("\n");
    }
}
