/**
 * The next-page parameter of the infinite hooks (`useEarningsInfinite` in `queries.ts`), kept pure so a node test
 * covers them without loading the server functions.
 */

/** The `offset` of a top-level `next_url` (as `useInsiderTradesInfinite`), else undefined = last page. */
export function offsetOfNextUrl(nextUrl: null | string | undefined) {
    if (!nextUrl) return undefined;

    try {
        const offset = Number(new URL(nextUrl, "http://localhost").searchParams.get("offset"));

        return Number.isNaN(offset) || offset <= 0 ? undefined : offset;
    }
    catch {
        return undefined;
    }
}

/** The default: an offset-paged list (every earnings list). */
export function offsetPageParam(lastPage: { next_url?: null | string }) {
    return offsetOfNextUrl(lastPage.next_url);
}

/** A keyset-paged list (`/v1/news`): the page's `next_cursor`, else undefined = last page. */
export function cursorPageParam(lastPage: { next_cursor?: null | string }) {
    return lastPage.next_cursor ?? undefined;
}

/** The first page's parameter: 0 only when the list names none, so a cursor list's `null` stays `null` (never `cursor: 0`). */
export function firstPageParam<TParam>(initial: TParam | undefined) {
    return initial === undefined ? (0 as TParam) : initial;
}
