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

/**
 * The statement tables' label column (ui-redesign task 9): a fixed width that truncates (the full text in `title`) —
 * 170 px on a phone, 240 px from 640, 260 px from 1280 — so 8 period columns (`PERIOD_CELL`, ≥ 84 px) fit beside it at
 * 1440 px with the request panel closed.
 */
export const STATEMENT_LABEL_CELL = "w-[170px] min-w-[170px] max-w-[170px] sm:w-[240px] sm:min-w-[240px] sm:max-w-[240px] xl:w-[260px] xl:min-w-[260px] xl:max-w-[260px]";

/** A statement table's period column (header and cells): right-aligned, at least 84 px. */
export const PERIOD_CELL = "min-w-[5.25rem] text-right";

/**
 * The one table header cell / row style (ui-redesign task 6): 12 px medium muted headers, 36 px rows with a hover fill.
 * Used by the `Table*` primitives, so `DataTable` and the statement tables (their own markup) share them. `group/row`
 * lets a cell show something on row hover (a copy button).
 */
export const TABLE_HEAD_CLASS = "text-muted-foreground h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap";

export const TABLE_ROW_CLASS = "group/row hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors";

/**
 * A row's small icon actions (the statement tables' catalog link and chart button, ui-redesign task 9): from `lg` on a
 * hover-capable pointer they wait for row hover / focus inside the row; on touch and below `lg` they always show.
 */
export const ROW_ACTION_REVEAL_CLASS = "lg:[@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100";

/**
 * A line tab list that wraps onto more rows instead of scrolling sideways (no tab hidden behind a scroll box, the page
 * never scrolls sideways): Holders, the filing page. The call page's ten tabs are one scrolling row instead
 * (`SCROLL_ROW_CLASS`, ui-redesign task 10).
 */
export const WRAPPING_TABS_LIST_CLASS = "flex-wrap justify-start gap-y-2 group-data-horizontal/tabs:h-auto";

/**
 * The call page's reading column (ui-redesign task 10): 14 / 24 px text, about 72 characters a line and never more than
 * 80. `ch` is the width of "0", which IBM Plex Sans draws wider than an average letter: `72ch` measured 92 characters a
 * line (101 at most) on a real transcript, `56ch` (≈ 470 px) gives ≈ 72 (≤ 80). `ch` follows the element's own size,
 * so the size is part of the class. Transcript turns in every format, Q&A, the live transcript, the press release.
 */
export const READING_COLUMN_CLASS = "max-w-[56ch] text-sm leading-6";

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
