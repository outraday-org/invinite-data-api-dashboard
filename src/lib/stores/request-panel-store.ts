import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { SnippetFormat } from "@/lib/api/request-snippets";

import { SNIPPET_FORMATS } from "@/lib/api/request-snippets";

/** From this width the request panel is docked beside the page; below it, it is a sheet over the page. */
export const DOCKED_PANEL_MIN_PX = 1280;

type RequestPanelState = {
    /** The form every row's request is shown and "Copy all as …" copies in (shared by the rows, remembered). */
    format: SnippetFormat;
    hasHydrated: boolean;
    open: boolean;
    markHydrated: () => void;
    setFormat: (format: SnippetFormat) => void;
    setOpen: (open: boolean) => void;
    toggle: () => void;
};

const inMemoryStorage = {
    getItem: (_name: string) => null,
    removeItem: (_name: string) => {},
    setItem: (_name: string, _value: string) => {},
};

const storage = createJSONStorage(() =>
    typeof window !== "undefined" ? window.localStorage : inMemoryStorage,
);

const isNarrow = () => typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia(`(max-width: ${DOCKED_PANEL_MIN_PX - 1}px)`).matches;

/**
 * Whether the request panel is open (ui-redesign task 3). Server and first client render are closed: the store skips
 * the automatic hydration and `RequestPanelToggle` calls `persist.rehydrate()` after mount. Below 1280 px a stored
 * "open" is ignored on load (a sheet never opens by itself).
 */
export const useRequestPanelStore = create<RequestPanelState>()(
    persist(
        set => ({
            format: "curl",
            hasHydrated: false,
            markHydrated: () => {
                if (typeof window === "undefined") return;

                set({ hasHydrated: true });
            },
            open: false,
            setFormat: format => set({ format }),
            setOpen: open => set({ open }),
            toggle: () => set(state => ({ open: !state.open })),
        }),
        {
            // `merge` runs on hydration only.
            merge: (persisted, current) => {
                const stored = persisted as Partial<RequestPanelState> | undefined;

                const open = stored?.open === true && !isNarrow();

                const format = SNIPPET_FORMATS.find(item => item.value === stored?.format)?.value ?? current.format;

                return { ...current, format, open };
            },
            name: "invinite-request-panel",
            onRehydrateStorage: () => (state) => {
                if (typeof window === "undefined") return;

                state?.markHydrated();
            },
            partialize: state => ({ format: state.format, open: state.open }),
            skipHydration: true,
            storage,
        },
    ),
);
