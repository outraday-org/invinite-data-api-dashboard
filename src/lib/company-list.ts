/** Companies one `company=` comma list may name (the API: 1–50). */
export const MAX_COMPANIES = 50;

/** A `?company=` value as its tickers / CIKs: comma separated, trimmed, upper case, no repeats, at most 50. */
export function parseCompanyList(text: null | string | undefined): Array<string> {
    if (!text) return [];

    const list = text.split(",").map(part => part.trim().toUpperCase()).filter(part => part.length > 0);

    return [...new Set(list)].slice(0, MAX_COMPANIES);
}

/** The comma list a URL and the API take; none = undefined (the param left out). */
export function joinCompanyList(list: ReadonlyArray<string>): string | undefined {
    return list.length > 0 ? list.join(",") : undefined;
}

/** A typed value that can stand for a company by itself: a ticker (`BRK.B`, `RDS-A`) or a CIK (digits). */
export function isCompanyToken(text: string) {
    return /^(?:\d{1,10}|[A-Z][A-Z0-9.-]{0,14})$/i.test(text.trim());
}
