import * as React from "react";

import { isCompanyToken } from "@/lib/company-list";

/**
 * The Companies field of `/news-feed` (backend tasks/data-api-dashboard O7 group 2): up to `WATCHLIST_MAX` tickers kept
 * in this browser only (`localStorage`; a private window or blocked storage = an empty list that still works for the
 * visit). The feed reads them as ONE `/v1/news?company=<comma list>` per page (the API takes 1–50 companies).
 */

export const WATCHLIST_MAX = 20;

export const WATCHLIST_STORAGE_KEY = "invinite.news-watchlist";

/** A list as kept: tickers / CIKs (`isCompanyToken`), upper case, no repeats, cut at `WATCHLIST_MAX`. */
export function normalizeWatchlist(list: ReadonlyArray<string>): Array<string> {
    return [...new Set(list.map(value => value.trim().toUpperCase()).filter(isCompanyToken))].slice(0, WATCHLIST_MAX);
}

/** A stored value read back: an array of valid tickers, else empty. */
export function readWatchlist(raw: null | string): Array<string> {
    if (!raw) return [];

    try {
        const parsed: unknown = JSON.parse(raw);

        return Array.isArray(parsed) ? normalizeWatchlist(parsed.filter((value): value is string => typeof value === "string")) : [];
    }
    catch {
        return [];
    }
}

function loadStored(): Array<string> {
    try {
        return readWatchlist(window.localStorage.getItem(WATCHLIST_STORAGE_KEY));
    }
    catch {
        return [];
    }
}

function store(list: ReadonlyArray<string>) {
    try {
        window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(list));
    }
    catch {
        // Storage blocked or full: the list lives for this visit only.
    }
}

/**
 * The watchlist and its setters. Read after mount (`ready`): the server render has no storage, so the first paint
 * never shows a list the browser does not hold.
 */
export function useWatchlist() {
    const [state, setState] = React.useState<{ list: Array<string>; ready: boolean }>({ list: [], ready: false });

    React.useEffect(() => {
        setState({ list: loadStored(), ready: true });
    }, []);

    const set = (list: ReadonlyArray<string>) => {
        const next = normalizeWatchlist(list);

        store(next);

        setState({ list: next, ready: true });
    };

    return { list: state.list, ready: state.ready, set };
}
