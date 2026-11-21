import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** A subject opened recently: an instrument (`/$ticker`) or an SEC filer / institution (`/sec/$cik`). */
export type RecentSubject
    = | { badge: null | string; kind: "filer"; label: string; name: null | string; ref: string }
        | { badge: null | string; kind: "instrument"; label: string; name: null | string; ref: string };

/** How many subjects the recents list keeps (newest first). */
export const RECENTS_MAX = 8;

type RecentsState = {
    addRecent: (subject: RecentSubject) => void;
    hasHydrated: boolean;
    markHydrated: () => void;
    recents: Array<RecentSubject>;
};

const inMemoryStorage = {
    getItem: (_name: string) => null,
    removeItem: (_name: string) => {},
    setItem: (_name: string, _value: string) => {},
};

const storage = createJSONStorage(() =>
    typeof window !== "undefined" ? window.localStorage : inMemoryStorage,
);

/** The recents list with `subject` on top (one entry per subject, at most `RECENTS_MAX`). */
export function withRecent(recents: ReadonlyArray<RecentSubject>, subject: RecentSubject): Array<RecentSubject> {
    const rest = recents.filter(entry => !(entry.kind === subject.kind && entry.ref === subject.ref));

    return [subject, ...rest].slice(0, RECENTS_MAX);
}

/**
 * The recently opened subjects (instruments and filers) of this browser: the search's empty state and the landing
 * page's "Recently opened". Written when an instrument or filer page has loaded its subject.
 */
export const useTickerStore = create<RecentsState>()(
    persist(
        set => ({
            addRecent: subject => set(state => ({ recents: withRecent(state.recents, subject) })),
            hasHydrated: false,
            markHydrated: () => {
                if (typeof window === "undefined") return;

                set({ hasHydrated: true });
            },
            recents: [],
        }),
        {
            name: "invinite-recents",
            onRehydrateStorage: () => (state) => {
                if (typeof window === "undefined") return;

                state?.markHydrated();
            },
            partialize: state => ({
                recents: state.recents,
            }),
            storage,
        },
    ),
);
