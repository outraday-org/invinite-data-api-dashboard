import type { FilingListRow } from "@/lib/sec/parity";

import type { LiveFiling } from "./ws-frames";

/**
 * The live filings list (pure; backend tasks/data-api-dashboard O7 group 3): every `new_filing` frame since the page
 * opened, newest first, one per accession, at most `MAX_LIVE_FILINGS`. The stream replays nothing: what arrived while
 * the page was closed (or the socket down) is not here.
 */

/** Most filings held (newest first). */
export const MAX_LIVE_FILINGS = 200;

export type ReceivedFiling = { filing: LiveFiling; receivedAt: string };

/** `filing` on top of `held` (an accession already held is kept where it is), capped at `max`. */
export function addLiveFiling(held: ReadonlyArray<ReceivedFiling>, filing: LiveFiling, receivedAt: string, max = MAX_LIVE_FILINGS): Array<ReceivedFiling> {
    if (held.some(entry => entry.filing.accession_number === filing.accession_number)) return [...held];

    return [{ filing, receivedAt }, ...held].slice(0, max);
}

/** Whether a live filing belongs to an instrument page: the frame's `ticker` is the company's primary listing. */
export function isFilingOf(filing: LiveFiling, symbol: string) {
    return filing.ticker !== null && filing.ticker.toUpperCase() === symbol.toUpperCase();
}

/** Whether a live filing has one of `forms` (case-insensitive; empty = every form). */
export function hasLiveForm(filing: LiveFiling, forms: ReadonlyArray<string>) {
    if (forms.length === 0) return true;

    const form = filing.form_type.toUpperCase();

    return forms.some(wanted => wanted.toUpperCase() === form);
}

/** The comma list of a text filter ("8-K, 10-Q" → ["8-K", "10-Q"]). */
export function commaList(value: string | undefined): Array<string> {
    return (value ?? "").split(",").map(part => part.trim()).filter(Boolean);
}

/** A live filing as a row of the filings list (`live: true`; the frame names no items or primary document). */
export function toLiveFilingRow(filing: LiveFiling): FilingListRow {
    return {
        accessionNumber: filing.accession_number,
        calendarQuarter: filing.calendar_quarter,
        calendarYear: filing.calendar_year,
        edgarIndexUrl: null,
        filingDate: filing.filing_date.slice(0, 10),
        fiscalQuarter: filing.fiscal_quarter,
        fiscalYear: filing.fiscal_year,
        formType: filing.form_type,
        items: [],
        live: true,
        periodEnd: filing.period_end ? filing.period_end.slice(0, 10) : null,
        primaryDocument: null,
    };
}

/** The live rows on top of the listed ones; a live accession already listed is shown once, as listed. */
export function mergeLiveRows(live: ReadonlyArray<FilingListRow>, listed: ReadonlyArray<FilingListRow>): Array<FilingListRow> {
    const listedIds = new Set(listed.map(row => row.accessionNumber));

    return [...live.filter(row => !listedIds.has(row.accessionNumber)), ...listed];
}
