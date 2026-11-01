/**
 * The News page's pager (owner 2026-11-01): `/v1/news` pages by a keyset cursor, so "Previous" cannot be computed —
 * the page keeps the stack of cursors it visited (`null` = the first page). Bound to the list's filters: a different
 * `key` (any filter or the date range changed) starts again at page 1. Pure: `pager.test.ts`.
 */
export type NewsPager = { key: string; stack: ReadonlyArray<null | string> };

export function firstNewsPage(key: string): NewsPager {
    return { key, stack: [null] };
}

/** The pager for the current filters: the stored one while its key matches, else page 1. */
export function newsPagerFor(pager: NewsPager, key: string): NewsPager {
    return pager.key === key ? pager : firstNewsPage(key);
}

/** The cursor of the page shown (`null` = the first page). */
export function newsPageCursor(pager: NewsPager): null | string {
    return pager.stack.at(-1) ?? null;
}

/** The page number shown, from 1. */
export function newsPageNumber(pager: NewsPager): number {
    return pager.stack.length;
}

/** One page further: the shown page's `next_cursor` pushed on the stack. */
export function nextNewsPage(pager: NewsPager, nextCursor: string): NewsPager {
    return { key: pager.key, stack: [...pager.stack, nextCursor] };
}

/** One page back (page 1 stays page 1); the previous page is read from the query cache, not from the start. */
export function previousNewsPage(pager: NewsPager): NewsPager {
    return pager.stack.length > 1 ? { key: pager.key, stack: pager.stack.slice(0, -1) } : pager;
}
