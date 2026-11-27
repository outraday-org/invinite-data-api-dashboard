import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ARRIVAL_FLASH_MS } from "./use-arrival-flash";

const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

describe(".row-arrive (styles.css)", () => {
    const rule = /\.row-arrive\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

    it("lasts as long as ARRIVAL_FLASH_MS, once, and has NO fill mode: after it ends the row's hover fill applies again", () => {
        expect(rule).toContain(`filing-arrive ${ARRIVAL_FLASH_MS / 1000}s ease-out 1`);

        expect(rule).not.toMatch(/forwards|backwards|both/);
    });

    it("flickers in the primary colour, then fades to transparent; a static tint with reduced motion", () => {
        const keyframes = /@keyframes filing-arrive\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";

        expect(keyframes).toMatch(/0%\s*\{ background-color: color-mix\(in oklch, var\(--primary\) 35%, transparent\)/);

        expect(keyframes).toMatch(/100% \{ background-color: transparent; \}/);

        expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.row-arrive\s*\{\s*animation: none;\s*background-color: color-mix\(in oklch, var\(--primary\) 15%, transparent\);/);
    });
});
