import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** A subject opened recently: an instrument (`/$ticker`), a spot coin (`/spot-coins/$coin`) or a filer (`/sec/$cik`). */
export type RecentSubject
    = | { badge: null | string; kind: "coin" | "filer"; label: string; name: null | string; ref: string }
        | { badge: null | string; kind: "instrument"; label: string; name: null | string; ref: string };

/** The recents before the store is hydrated (one stable empty list: a selector must not build a new one per call). */
export const NO_RECENTS: ReadonlyArray<RecentSubject> = [];

/** The hydrated recents (none during the server render and before hydration). */
export const selectRecents = (state: { hasHydrated: boolean; recents: Array<RecentSubject> }): ReadonlyArray<RecentSubject> =>
    (state.hasHydrated ? state.recents : NO_RECENTS);

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
 * The recently opened subjects (instruments, coins and filers) of this browser: the search's empty state and the landing
 * page's "Recently opened". Written when a subject page has loaded its profile.
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
