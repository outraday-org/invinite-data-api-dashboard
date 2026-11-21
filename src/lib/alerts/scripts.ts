import type { AlertTemplate, JsonValue, Script, ScriptDiagnostic, ScriptVersion } from "@/lib/api/types";

import { formatNumber } from "@/lib/format";
import { isRecord } from "@/lib/guards";

/**
 * Hosted scripts and the built-in indicator templates (backend tasks/data-api-dashboard 2-alerts task 4), pure and
 * tested: the upload bounds (checked before anything is sent), the manifest's declared inputs read through guards
 * (the spec types `manifest` as a free object: chartlang's `inputs` = `{ [name]: { kind, defaultValue, title?, min?,
 * max?, step?, options? } }`), the alert ids a delete's 409 names, diagnostics by line.
 */

/** `source` of both creates: `maxLength` 204 800 (≈ 200 KB). */
export const SCRIPT_SOURCE_MAX = 204_800;

export const SCRIPT_NAME_MAX = 100;

export const SCRIPT_DESCRIPTION_MAX = 1000;

/** Versions per script ("at most 20"). */
export const SCRIPT_VERSIONS_MAX = 20;

/**
 * Why a source cannot be uploaded, or null. Counted in UTF-16 units (`length`), never fewer than the spec's characters,
 * so a refused source would also be refused by the API, and an accepted one is not over its limit.
 */
export function sourceProblem(source: string): null | string {
    if (source.trim() === "") return "The source is empty.";

    if (source.length > SCRIPT_SOURCE_MAX) return `The source has ${formatNumber(source.length)} characters; at most ${formatNumber(SCRIPT_SOURCE_MAX)} can be uploaded.`;

    return null;
}

/** The upload form's problems by field (`name`, `description`, `source`); empty = it may be sent. */
export function scriptUploadErrors(input: { description?: string; name?: string; source: string }, { needsName }: { needsName: boolean }): Record<string, string> {
    const errors: Record<string, string> = {};

    if (needsName) {
        const name = input.name?.trim() ?? "";

        if (name === "") errors.name = "A name is required.";
        else if (name.length > SCRIPT_NAME_MAX) errors.name = `At most ${SCRIPT_NAME_MAX} characters.`;

        if ((input.description?.trim().length ?? 0) > SCRIPT_DESCRIPTION_MAX) errors.description = `At most ${SCRIPT_DESCRIPTION_MAX} characters.`;
    }

    const source = sourceProblem(input.source);

    if (source) errors.source = source;

    return errors;
}

/** Whether another version can be uploaded (the 20-version limit). */
export function canAddVersion(script: Pick<Script, "version_count">) {
    return script.version_count < SCRIPT_VERSIONS_MAX;
}

export type DeclaredInput = {
    default: JsonValue | undefined;
    kind: string;
    max?: number;
    min?: number;
    name: string;
    options?: Array<string>;
    step?: number;
    title: string;
};

const numberOf = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/** The declared inputs of a version's manifest (null manifest = a failed compile = none; an unknown shape = none). */
export function manifestInputs(manifest: JsonValue | null): Array<DeclaredInput> {
    if (!isRecord<JsonValue>(manifest) || !isRecord<JsonValue>(manifest.inputs)) return [];

    return Object.entries(manifest.inputs).flatMap(([name, descriptor]) => {
        if (!isRecord<JsonValue>(descriptor)) return [];

        const options = Array.isArray(descriptor.options) ? descriptor.options.map(String) : undefined;

        return [{
            default: descriptor.defaultValue ?? descriptor.default,
            kind: typeof descriptor.kind === "string" ? descriptor.kind : "unknown",
            max: numberOf(descriptor.max),
            min: numberOf(descriptor.min),
            name,
            options,
            step: numberOf(descriptor.step),
            title: typeof descriptor.title === "string" && descriptor.title.trim() ? descriptor.title : name,
        }];
    });
}

/** A declared / template input's bounds or options in words ("1–200", "≥ 2", "up, down"); "" without. */
export function inputRangeText(input: { max?: number; min?: number; options?: ReadonlyArray<string> }) {
    if (input.options && input.options.length > 0) return input.options.join(", ");

    if (input.min !== undefined && input.max !== undefined) return `${input.min}–${input.max}`;

    if (input.min !== undefined) return `≥ ${input.min}`;

    return input.max === undefined ? "" : `≤ ${input.max}`;
}

/** A default value as text (strings quoted only when empty). */
export function defaultText(value: JsonValue | undefined) {
    if (value === undefined) return "—";

    if (typeof value === "string") return value === "" ? "\"\"" : value;

    return JSON.stringify(value);
}

/**
 * The alert ids a 409 of `deleteScript` names in its `detail` ("The script is used by alerts alt_1, alt_2 and more"):
 * the contract has no structured list (nor a `listAlerts` filter by script), so the ids are read from the words.
 */
export function alertIdsInDetail(detail: string): Array<string> {
    return [...new Set(detail.match(/\balt_[\w-]+/g) ?? [])];
}

/** The versions newest first (the API lists them oldest first). */
export function versionsNewestFirst(versions: ReadonlyArray<ScriptVersion>) {
    return [...versions].sort((a, b) => b.version - a.version);
}

/** Diagnostics by 1-based line (a line outside the source still keeps its entry). */
export function diagnosticsByLine(diagnostics: ReadonlyArray<ScriptDiagnostic>) {
    const lines = new Map<number, Array<ScriptDiagnostic>>();

    for (const diagnostic of diagnostics) lines.set(diagnostic.line, [...(lines.get(diagnostic.line) ?? []), diagnostic]);

    return lines;
}

/** A version's diagnostics in one line ("2 errors, 1 warning" / "No diagnostics"). */
export function diagnosticsSummary(diagnostics: ReadonlyArray<Pick<ScriptDiagnostic, "severity">>) {
    const errors = diagnostics.filter(item => item.severity === "error").length;

    const warnings = diagnostics.length - errors;

    const parts = [errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : null, warnings > 0 ? `${warnings} warning${warnings === 1 ? "" : "s"}` : null].filter(Boolean);

    return parts.length > 0 ? parts.join(", ") : "No diagnostics";
}

/** `AlertTemplate.fidelity` in one line (the spec's meaning). */
export const FIDELITY_MEANING: Record<AlertTemplate["fidelity"], string> = {
    exact: "Its state restores from a snapshot after a restart.",
    lossy: "It warms up from history again after a restart (the crossover templates).",
};
