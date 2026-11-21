import type { V2HolderChangeType } from "@/lib/api/types";

/**
 * View helpers of the ownership and offerings pages (backend tasks/data-api-dashboard O7 group 6): insider transaction
 * codes, the 13F change-type filter as URL text, Form D offering ids.
 */

/** An offering id: a Form D file number (`021-599503`) or the first accession number of an offering without one. */
export const OFFERING_ID_PATTERN = /^(\d{3}-\d{1,8}|\d{10}-\d{2}-\d{6})$/;

/** The SEC's Form 4 transaction codes (General Instructions, item 8), in words. */
export const INSIDER_CODE_LABELS: Readonly<Record<string, string>> = {
    A: "Grant or award",
    C: "Conversion of a derivative",
    D: "Disposition to the issuer",
    E: "Expiration of a short derivative position",
    F: "Shares withheld for exercise price or tax",
    G: "Gift",
    H: "Expiration of a long derivative position (value received)",
    I: "Discretionary transaction",
    J: "Other acquisition or disposition",
    K: "Equity swap",
    L: "Small acquisition",
    M: "Exercise or conversion of a derivative (exempt)",
    O: "Exercise of an out-of-the-money derivative",
    P: "Open market or private purchase",
    S: "Open market or private sale",
    U: "Tender of shares in a change of control",
    V: "Voluntarily reported earlier",
    W: "Acquisition or disposition by will or the laws of descent",
    X: "Exercise of an in-the-money or at-the-money derivative",
    Z: "Deposit into or withdrawal from a voting trust",
};

/** "S · Open market or private sale"; an unknown code stays as filed. */
export function insiderCodeText(code: null | string | undefined): null | string {
    if (!code) return null;

    const label = INSIDER_CODE_LABELS[code];

    return label ? `${code} · ${label}` : code;
}

/** The codes of the loaded rows (first appearance order), each with its words: the table's legend. */
export function insiderCodeLegend(codes: ReadonlyArray<null | string | undefined>): Array<{ code: string; label: string }> {
    const seen = new Set<string>();

    return codes.flatMap((code) => {
        if (!code || seen.has(code)) return [];

        seen.add(code);

        return [{ code, label: INSIDER_CODE_LABELS[code] ?? "As filed" }];
    });
}

export const CHANGE_TYPES = ["new", "added", "reduced", "sold_out", "unchanged"] as const satisfies ReadonlyArray<V2HolderChangeType>;

/** The URL's `new,added` (any order, de-duplicated) → the types in the API's order; empty / invalid = undefined. */
export function parseChangeTypes(text: string | undefined): Array<V2HolderChangeType> | undefined {
    if (!text) return undefined;

    const picked = new Set(text.split(","));

    const types = CHANGE_TYPES.filter(type => picked.has(type));

    return types.length > 0 ? types : undefined;
}

/** The types → the URL's `new,added` (the API's order); none = undefined (the server default: every change but unchanged). */
export function changeTypesParam(types: ReadonlyArray<V2HolderChangeType>): string | undefined {
    const text = CHANGE_TYPES.filter(type => types.includes(type)).join(",");

    return text || undefined;
}

/** A comma list of manager CIKs as typed ("102909, 2012383") → digits only, de-duplicated, ≤ 50; none = undefined. */
export function parseCikList(text: string | undefined): Array<string> | undefined {
    const ciks = [...new Set((text ?? "").split(/[\s,]+/).filter(part => /^\d{1,10}$/.test(part)).map(part => String(Number(part))))].slice(0, 50);

    return ciks.length > 0 ? ciks : undefined;
}
