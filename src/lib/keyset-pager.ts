/**
 * A keyset list's pager (the News pages since owner 2026-11-01, `/filings` since Data API 12.3): the list pages by a
 * keyset cursor, so "Previous" cannot be computed — the page keeps the stack of cursors it visited (`null` = the first
 * page). Bound to the list's filters: a different `key` (any filter or the date range changed) starts again at page 1.
 * Pure: `keyset-pager.test.ts`. The control under a table: `KeysetPagerNav` (`src/components/ui/keyset-pager.tsx`).
 */
export type KeysetPager = { key: string; stack: ReadonlyArray<null | string> };

export function firstPage(key: string): KeysetPager {
    return { key, stack: [null] };
}

/** The pager for the current filters: the stored one while its key matches, else page 1. */
export function pagerFor(pager: KeysetPager, key: string): KeysetPager {
    return pager.key === key ? pager : firstPage(key);
}

/** The cursor of the page shown (`null` = the first page). */
export function pageCursor(pager: KeysetPager): null | string {
    return pager.stack.at(-1) ?? null;
}

/** The page number shown, from 1. */
export function pageNumber(pager: KeysetPager): number {
    return pager.stack.length;
}

/** One page further: the shown page's `next_cursor` pushed on the stack. */
export function nextPage(pager: KeysetPager, nextCursor: string): KeysetPager {
    return { key: pager.key, stack: [...pager.stack, nextCursor] };
}

/** One page back (page 1 stays page 1); the previous page is read from the query cache, not from the start. */
export function previousPage(pager: KeysetPager): KeysetPager {
    return pager.stack.length > 1 ? { key: pager.key, stack: pager.stack.slice(0, -1) } : pager;
}
