// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { isDark, nextTheme, THEME_SCRIPT, THEME_STORAGE_KEY, toTheme } from "./theme";

const runScript = (systemDark: boolean) => {
    vi.stubGlobal("matchMedia", (query: string) => ({ addEventListener: () => undefined, matches: systemDark && query.includes("dark"), removeEventListener: () => undefined }));

    // The inline script as the browser runs it, before the first paint.
    new Function(THEME_SCRIPT)();
};

afterEach(() => {
    vi.unstubAllGlobals();

    localStorage.clear();

    document.documentElement.classList.remove("dark");
});

describe("theme", () => {
    it("system / light / dark, anything else = system", () => {
        expect(toTheme("dark")).toBe("dark");

        expect(toTheme("purple")).toBe("system");

        expect(nextTheme("system")).toBe("light");

        expect(nextTheme("dark")).toBe("system");

        expect(isDark("system", true)).toBe(true);

        expect(isDark("light", true)).toBe(false);
    });

    it("the no-flash script sets `.dark` from the stored choice, else from the system", () => {
        localStorage.setItem(THEME_STORAGE_KEY, "dark");

        runScript(false);

        expect(document.documentElement.classList.contains("dark")).toBe(true);

        localStorage.setItem(THEME_STORAGE_KEY, "light");

        runScript(true);

        expect(document.documentElement.classList.contains("dark")).toBe(false);

        localStorage.removeItem(THEME_STORAGE_KEY);

        runScript(true);

        expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
});
