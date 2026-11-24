import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { isRecord } from "@/lib/guards";

type SidebarGroupsState = {
    hasHydrated: boolean;
    /** The groups the reader opened (true) or closed (false); a group not in it is at its `defaultOpen`. */
    open: Record<string, boolean>;
    markHydrated: () => void;
    setGroupOpen: (id: string, open: boolean) => void;
};

const inMemoryStorage = {
    getItem: (_name: string) => null,
    removeItem: (_name: string) => {},
    setItem: (_name: string, _value: string) => {},
};

const storage = createJSONStorage(() =>
    typeof window !== "undefined" ? window.localStorage : inMemoryStorage,
);

/**
 * Which sidebar groups are open (ui-redesign task 4). Server and first client render use each group's `defaultOpen`:
 * the store skips the automatic hydration and `AppSidebar` calls `persist.rehydrate()` after mount (as the request
 * panel's store).
 */
export const useSidebarGroupsStore = create<SidebarGroupsState>()(
    persist(
        set => ({
            hasHydrated: false,
            markHydrated: () => {
                if (typeof window === "undefined") return;

                set({ hasHydrated: true });
            },
            open: {},
            setGroupOpen: (id, open) => set(state => ({ open: { ...state.open, [id]: open } })),
        }),
        {
            // `merge` runs on hydration only: keep the boolean entries of a stored object, drop anything else.
            merge: (persisted, current) => {
                const stored = isRecord(persisted) ? persisted.open : undefined;

                const open = isRecord(stored)
                    ? Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"))
                    : {};

                return { ...current, open };
            },
            name: "invinite-sidebar-groups",
            onRehydrateStorage: () => (state) => {
                if (typeof window === "undefined") return;

                state?.markHydrated();
            },
            partialize: state => ({ open: state.open }),
            skipHydration: true,
            storage,
        },
    ),
);
