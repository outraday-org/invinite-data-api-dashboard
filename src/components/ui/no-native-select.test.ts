import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every picker is the shared `DropdownSelect` (`src/components/ui/dropdown-select.tsx`, a `DropdownMenu` with radio
 * items; `FilterSelect` wraps it): never a native `<select>` (its arrow sits wherever the browser draws it, flush with
 * the border at small paddings) and never the `Select` primitive (owner, 2026-11-24).
 */

const SRC = join(__dirname, "..", "..");

function sourceFiles(dir: string): Array<string> {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);

        if (statSync(path).isDirectory()) return sourceFiles(path);

        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
    });
}

const files = sourceFiles(SRC).map(path => ({ path: relative(SRC, path).split("\\").join("/"), text: readFileSync(path, "utf8") }));

describe("no native select, no Select primitive", () => {
    it("renders no `<select>` element", () => {
        // A backticked `<select>` in a comment is prose, not an element.
        expect(files.filter(file => /(^|[^`])<select\b/m.test(file.text)).map(file => file.path)).toEqual([]);

        // Nor one created without JSX.
        expect(files.filter(file => /createElement\(\s*"select"/.test(file.text)).map(file => file.path)).toEqual([]);
    });

    it("imports neither `ui/select` nor the base-ui select", () => {
        expect(files.filter(file => /from "(@\/components\/ui\/select|@base-ui\/react\/select)"/.test(file.text)).map(file => file.path)).toEqual([]);

        // Nor through the package's barrel (`import { Select } from "@base-ui/react"`).
        expect(files.filter(file => /import\s*\{[^}]*\bSelect\b[^}]*\}\s*from "@base-ui\/react"/.test(file.text)).map(file => file.path)).toEqual([]);
    });
});
