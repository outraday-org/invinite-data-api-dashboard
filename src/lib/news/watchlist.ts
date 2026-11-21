import * as React from "react";

/**
 * The news watchlist of `/news-feed` (backend tasks/data-api-dashboard O7 group 2): up to `WATCHLIST_MAX` tickers kept
 * in this browser only (`localStorage`; a private window or blocked storage = an empty list that still works for the
 * visit). The feed reads them as ONE `/v1/news?company=<comma list>` per page (the API takes 1–50 companies).
 */

export const WATCHLIST_MAX = 20;

export const WATCHLIST_STORAGE_KEY = "invinite.news-watchlist";

/** A ticker as typed: letters, digits, one class separator (`BRK.B`, `BRK-B`); at most 10 characters. */
const TICKER_PATTERN = /^[A-Z0-9]{1,6}(?:[.-][A-Z0-9]{1,3})?$/;

/** The tickers of a typed line ("aapl, msft nvda" → AAPL, MSFT, NVDA): upper case, valid ones only, no repeats. */
export function parseTickers(text: string): Array<string> {
    const tickers = text.toUpperCase().split(/[\s,;]+/).filter(value => TICKER_PATTERN.test(value));

    return [...new Set(tickers)];
}

/** The list with `tickers` added at the end (no repeats), cut at `WATCHLIST_MAX`. */
export function addTickers(list: ReadonlyArray<string>, tickers: ReadonlyArray<string>): Array<string> {
    return [...new Set([...list, ...tickers])].slice(0, WATCHLIST_MAX);
}

/** A stored value read back: an array of valid tickers, else empty. */
export function readWatchlist(raw: null | string): Array<string> {
    if (!raw) return [];

    try {
        const parsed: unknown = JSON.parse(raw);

        return Array.isArray(parsed) ? addTickers([], parsed.filter((value): value is string => typeof value === "string" && TICKER_PATTERN.test(value))) : [];
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

    const update = (next: Array<string>) => {
        store(next);

        setState({ list: next, ready: true });
    };

    return {
        add: (tickers: ReadonlyArray<string>) => update(addTickers(state.list, tickers)),
        list: state.list,
        ready: state.ready,
        remove: (ticker: string) => update(state.list.filter(value => value !== ticker)),
    };
}
