import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The "## Operation coverage" table of the dashboard `CLAUDE.md` lists every operation id of `openapi.json` exactly
 * once, with the page that shows it or the reason it has none (backend tasks/data-api-dashboard, A4-final). A new
 * operation in the spec fails here until its row is written; so does a row whose request no longer matches the spec.
 */

const ROOT = resolve(__dirname, "../../..");

const spec = JSON.parse(readFileSync(resolve(ROOT, "openapi.json"), "utf8")) as {
    paths: Record<string, Record<string, unknown>>;
};

const specOperations = Object.entries(spec.paths).flatMap(([path, item]) =>
    Object.entries(item).flatMap(([method, operation]) => {
        const id = (operation as null | { operationId?: unknown })?.operationId;

        return typeof id === "string" ? [{ id, request: `${method.toUpperCase()} ${path}` }] : [];
    }));

/** The table rows of the coverage section: the id of the first cell, the second cell, the third cell. */
function coverageRows(markdown: string): Array<{ id: string; page: string; request: string }> {
    const start = markdown.indexOf("\n## Operation coverage\n");

    expect(start).toBeGreaterThanOrEqual(0);

    const next = markdown.indexOf("\n## ", start + 1);

    const section = markdown.slice(start, next === -1 ? undefined : next);

    return section.split("\n").flatMap((line) => {
        const cells = line.split(" | ");

        const id = /^\| `(\w+)`/.exec(line)?.[1];

        if (!id || cells.length < 3) return [];

        return [{ id, page: cells.slice(2).join(" | ").replace(/\s*\|\s*$/, "").trim(), request: cells[1].trim() }];
    });
}

const rows = coverageRows(readFileSync(resolve(ROOT, "CLAUDE.md"), "utf8"));

describe("CLAUDE.md operation coverage table", () => {
    it("lists every operation id of openapi.json exactly once (137 HTTP + WS streamEvents = 138)", () => {
        const ids = rows.map(row => row.id);

        expect(specOperations).toHaveLength(138);

        expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);

        expect([...ids].sort()).toEqual(specOperations.map(operation => operation.id).sort());
    });

    it("names each operation's request as the spec does, and a page or a reason", () => {
        const requestById = new Map(specOperations.map(operation => [operation.id, operation.request]));

        for (const row of rows) {
            expect(row.request.replaceAll("`", "").startsWith(requestById.get(row.id) ?? "?"), row.id).toBe(true);

            expect(row.page.length, row.id).toBeGreaterThan(0);
        }
    });
});
