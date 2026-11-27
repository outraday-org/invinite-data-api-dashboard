import type { V2Filing } from "@/lib/api/types";
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

// ── The market-wide list (`/filings`, Data API 12.3) ──────────────────────────────────────────────────────────────
// `GET /v1/filings` without `symbol` (REST, newest first) prefills the list; `new_filing` frames go on top, once per
// accession. One row type for both sources, so the page renders and exports one shape.

/** One row of `/filings`, from the REST list (`listed`) or a live frame (`live`). */
export type LatestFilingRow = {
    accession: string;
    /** When the row's live frame arrived (a listed row keeps it when the same accession also arrived live); null = REST only. */
    arrivedAt: null | string;
    /** The filer's CIK, 10 digits; null = unknown. */
    cik: null | string;
    /** `filing_date` (`YYYY-MM-DD`): EDGAR dates an after-hours filing with the next business day. */
    filedDay: string;
    /** The acceptance instant when known (REST `filed_at`); null on live rows. */
    filedAt: null | string;
    filerName: null | string;
    form: string;
    periodEnd: null | string;
    /** Tickers a registration statement proposes (live frames only; REST rows carry none). */
    proposedTickers: ReadonlyArray<string>;
    source: "listed" | "live";
    /** The filer's instrument (null: a pre-IPO issuer, a Form D filer, a 13F manager, an insider). */
    ticker: null | string;
};

/** A CIK as 10 digits ("320193" → "0000320193"); null for anything that is not a CIK. */
export function padCik(cik: null | string | undefined): null | string {
    return cik && /^\d{1,10}$/.test(cik) ? cik.padStart(10, "0") : null;
}

/** The filer prefix of an accession number ("0001493152-26-054062" → "0001493152"): the filing agent or the filer. */
function accessionPrefix(accession: string): null | string {
    return /^\d{10}-/.test(accession) ? accession.slice(0, 10) : null;
}

/** A `/v1/filings` row: `ticker` = `symbol`, the filer from `filer`, else `company`, else the accession's prefix. */
export function fromRestFiling(filing: V2Filing): LatestFilingRow {
    return {
        accession: filing.accession,
        arrivedAt: null,
        cik: padCik(filing.filer?.cik ?? filing.company?.cik) ?? accessionPrefix(filing.accession),
        filedAt: filing.filed_at ?? null,
        filedDay: filing.filing_date.slice(0, 10),
        filerName: filing.filer?.name ?? null,
        form: filing.form,
        periodEnd: filing.report_date ? filing.report_date.slice(0, 10) : null,
        proposedTickers: [],
        source: "listed",
        ticker: filing.symbol,
    };
}

/** A `new_filing` frame received at `receivedAt`. */
export function fromLiveFiling(filing: LiveFiling, receivedAt: string): LatestFilingRow {
    return {
        accession: filing.accession_number,
        arrivedAt: receivedAt,
        cik: padCik(filing.cik),
        filedAt: null,
        filedDay: filing.filing_date.slice(0, 10),
        filerName: null,
        form: filing.form_type,
        periodEnd: filing.period_end ? filing.period_end.slice(0, 10) : null,
        proposedTickers: (filing.proposed_symbols ?? []).map(symbol => symbol.symbol),
        source: "live",
        ticker: filing.ticker,
    };
}

/**
 * The list shown: on page 1 the live rows whose accession is not listed (newest arrival first, as held — the hook caps
 * them at `MAX_LIVE_FILINGS`), then the listed rows in API order (never cut, never re-sorted). An accession in both is
 * shown once, as listed, with the frame's `arrivedAt` (it can still flash). Later pages are the listed rows alone.
 */
export function mergeLatest(live: ReadonlyArray<ReceivedFiling>, listed: ReadonlyArray<V2Filing>, page = 1): Array<LatestFilingRow> {
    const listedRows = listed.map(fromRestFiling);

    if (page !== 1) return listedRows;

    const arrivals = new Map(live.map(entry => [entry.filing.accession_number, entry.receivedAt]));

    const listedIds = new Set(listedRows.map(row => row.accession));

    return [
        ...live.filter(entry => !listedIds.has(entry.filing.accession_number)).map(entry => fromLiveFiling(entry.filing, entry.receivedAt)),
        ...listedRows.map(row => ({ ...row, arrivedAt: arrivals.get(row.accession) ?? null })),
    ];
}
