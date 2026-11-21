import * as React from "react";

/** The theme choice of this browser: follow the system, or a fixed light / dark. */
export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

/** The localStorage key (read by the inline no-flash script before the first paint too). */
export const THEME_STORAGE_KEY = "invinite-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in `<head>` before the body paints (inline in `__root.tsx`): sets `.dark` on `<html>` from the stored choice, so
 * a reload never flashes the other theme. Kept dependency-free and self-contained (it is stringified).
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="dark"||(t!=="light"&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";}catch(_){}})();`;

/** A stored value as a theme (anything else = system). */
export function toTheme(value: unknown): Theme {
    return (THEMES as ReadonlyArray<unknown>).includes(value) ? value as Theme : "system";
}

/** Whether a choice renders dark, given the system's preference. */
export function isDark(theme: Theme, systemDark: boolean) {
    return theme === "dark" || (theme === "system" && systemDark);
}

/** The next choice of the toggle: system → light → dark → system. */
export function nextTheme(theme: Theme): Theme {
    return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

const listeners = new Set<() => void>();

function readTheme(): Theme {
    try {
        return toTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
    }
    catch {
        return "system";
    }
}

function apply(theme: Theme) {
    const dark = isDark(theme, window.matchMedia(DARK_QUERY).matches);

    document.documentElement.classList.toggle("dark", dark);

    document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function subscribe(listener: () => void) {
    listeners.add(listener);

    const media = window.matchMedia(DARK_QUERY);

    // A system change re-applies a "system" choice.
    const onSystem = () => {
        apply(readTheme());

        listener();
    };

    media.addEventListener("change", onSystem);

    return () => {
        listeners.delete(listener);

        media.removeEventListener("change", onSystem);
    };
}

/** The stored theme and its setter (stored per browser; the server render reads "system"). */
export function useTheme(): [Theme, (theme: Theme) => void] {
    const theme = React.useSyncExternalStore(subscribe, readTheme, () => "system" as const);

    const setTheme = React.useCallback((next: Theme) => {
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, next);
        }
        catch {
            // Storage refused (private mode): the choice holds for this page only.
        }

        apply(next);

        for (const listener of listeners) listener();
    }, []);

    return [theme, setTheme];
}
