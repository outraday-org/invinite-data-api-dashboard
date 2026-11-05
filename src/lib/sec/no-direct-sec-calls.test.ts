import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No code path fetches sec.gov or an LLM directly: SEC data comes only through the data API (`createApiClient`).
 * sec.gov may appear as an outbound link (`href`, `edgarFolderUrl`, a host check) but never as a request target.
 */

const SRC = join(__dirname, "..", "..");

function sourceFiles(dir: string): Array<string> {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);

        if (statSync(path).isDirectory()) return sourceFiles(path);

        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
    });
}

const files = sourceFiles(SRC).map(path => ({ path: relative(SRC, path), text: readFileSync(path, "utf8") }));

const LLM_HOSTS = /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.perplexity\.ai/;

describe("no direct SEC / LLM traffic", () => {
    it("no request call names sec.gov", () => {
        const offenders = files.flatMap(({ path, text }) =>
            text.split("\n").flatMap((line, index) =>
                /\b(fetch|axios|XMLHttpRequest|ky|got)\b.*sec\.gov|sec\.gov.*\bfetch\(/.test(line) ? [`${path}:${index + 1}`] : []));

        expect(offenders).toEqual([]);
    });

    it("no file names an LLM API host", () => {
        expect(files.filter(({ text }) => LLM_HOSTS.test(text)).map(({ path }) => path)).toEqual([]);
    });

    it("the SEC views and helpers make no request of their own (only the data API hooks)", () => {
        const sec = files.filter(({ path }) => path.startsWith("components/sec/") || path.startsWith("lib/sec/"));

        expect(sec.length).toBeGreaterThan(0);

        expect(sec.filter(({ text }) => /\bfetch\(|new XMLHttpRequest|new WebSocket/.test(text)).map(({ path }) => path)).toEqual([]);
    });

    it("every /v1/sec server function goes through the data API client", () => {
        const serverFunctions = files.find(({ path }) => path === join("lib", "api", "server-functions.ts"));

        expect(serverFunctions?.text).toContain("createApiClient(");

        expect(serverFunctions?.text).not.toMatch(/\bfetch\(/);
    });
});
