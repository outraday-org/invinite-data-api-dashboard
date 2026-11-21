/**
 * The page shell's pinned offsets. The document scrolls; pinned are the top bar (`--app-topbar-height`, set on
 * `<body>` in `__root.tsx`) and, on ticker pages, the instrument header below it (`--ticker-header-height`, measured by
 * `$ticker/route.tsx`; `0px` elsewhere). Anything else that sticks (a table header, the call player) sits below both.
 */
export const STICKY_TOP_CLASS = "top-[calc(var(--app-topbar-height,0px)+var(--ticker-header-height,0px))]";

/** The same offset from the `lg` breakpoint up (a literal: Tailwind only sees class names written out in the source). */
export const LG_STICKY_TOP_CLASS = "lg:top-[calc(var(--app-topbar-height,0px)+var(--ticker-header-height,0px))]";

/** The statement tables' first column: it stays while the table scrolls sideways in its wrapper (opaque, row hover kept). */
export const STICKY_FIRST_CELL = "sticky left-0 z-10 bg-background group-hover:bg-muted";

/** The CSS variable the ticker layout writes on `<html>` (the instrument header's height, `0px` without one). */
export const TICKER_HEADER_HEIGHT_VAR = "--ticker-header-height";

/** "AAPL · Dividends — Invinite Data" (or "Funds — Invinite Data"): the document title of a route. */
export function pageTitle(...parts: ReadonlyArray<null | string | undefined>) {
    const named = parts.filter((part): part is string => Boolean(part && part.trim()));

    return named.length > 0 ? `${named.join(" · ")} — Invinite Data` : "Invinite Data";
}

/** A route's `head` with its document title. */
export function titleHead(...parts: ReadonlyArray<null | string | undefined>) {
    return { meta: [{ title: pageTitle(...parts) }] };
}

/** The `head` of a `/$ticker/*` route: the URL's symbol (upper-cased) and the section name. */
export function tickerHead(ticker: string, section: null | string) {
    return titleHead(ticker.toUpperCase(), section);
}
