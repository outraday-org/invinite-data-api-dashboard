import { z } from "zod";

import type { EarningsCompanyDocument, JsonValue } from "@/lib/api/types";

/**
 * Company document kinds (IDA `COMPANY_DOCUMENT_KINDS` in `src/lib/earnings/constants.ts`; the spec types `kind` as a
 * free string list). Change with IDA. Filter-chip order.
 */
export const COMPANY_DOCUMENT_KINDS = [
    "annual_report",
    "ceo_letter",
    "proxy_statement",
    "proxy_supplement",
    "esg_report",
    "conference_presentation",
    "investor_day_deck",
    "earnings_deck",
    "fact_sheet",
    "financial_data",
    "shareholder_letter",
    "company_transcript",
    "cfo_commentary",
    "governance",
    "press_release",
    "infographic",
    "webcast",
    "other",
    "prepared_remarks",
] as const;

export type CompanyDocumentKind = (typeof COMPANY_DOCUMENT_KINDS)[number];

/** The sections of a company's IR site (IDA `IR_SECTION_KINDS`), in tree order. Change with IDA. */
export const IR_SECTION_KINDS = [
    "quarterly_results",
    "events_archive",
    "presentations_archive",
    "annual_reports",
    "proxy",
    "sec_filings",
    "press_releases",
    "esg",
    "governance",
    "faq",
    "other",
] as const;

export type IrSectionKind = (typeof IR_SECTION_KINDS)[number];

export const SECTION_LABELS: Record<IrSectionKind, string> = {
    annual_reports: "Annual reports",
    esg: "ESG",
    events_archive: "Events",
    faq: "FAQ",
    governance: "Governance",
    other: "Other",
    presentations_archive: "Presentations",
    press_releases: "Press releases",
    proxy: "Proxy",
    quarterly_results: "Quarterly results",
    sec_filings: "SEC filings",
};

/** "annual report" for `annual_report` (the call Documents tab's label rule). */
export const documentKindLabel = (kind: string) => kind.replaceAll("_", " ");

export const sectionLabel = (section: string) =>
    (SECTION_LABELS as Record<string, string | undefined>)[section] ?? documentKindLabel(section);

// Every field optional: a bare `/$ticker/documents` link shows the whole library; an invalid value
// falls back to "no filter" instead of failing the route (as the calendar filters).
const documentsSearchSchema = z.object({
    kind: z.enum(COMPANY_DOCUMENT_KINDS).optional().catch(undefined),
    section: z.enum(IR_SECTION_KINDS).optional().catch(undefined),
    year: z.coerce.number().int().min(1990).max(2100).optional().catch(undefined),
});

export type DocumentsSearch = z.infer<typeof documentsSearchSchema>;

/** `validateSearch` of the Documents route. */
export function validateDocumentsSearch(search: Record<string, unknown>): DocumentsSearch {
    return documentsSearchSchema.parse(search);
}

type TreeDocument = { section: string; year: null | number };

export type DocumentYearGroup<T extends TreeDocument> = { documents: Array<T>; year: null | number };

export type DocumentSectionGroup<T extends TreeDocument> = {
    count: number;
    section: string;
    years: Array<DocumentYearGroup<T>>;
};

const sectionRank = (section: string) => {
    const index = (IR_SECTION_KINDS as ReadonlyArray<string>).indexOf(section);

    return index === -1 ? IR_SECTION_KINDS.length : index;
};

/**
 * Section → year tree of the loaded documents: sections in `IR_SECTION_KINDS` order (an unknown section after
 * them, by name), years newest first with undated (`year: null`) last; within a year the API's order is kept.
 */
export function groupDocumentTree<T extends TreeDocument>(documents: ReadonlyArray<T>): Array<DocumentSectionGroup<T>> {
    const bySection = new Map<string, Map<null | number, Array<T>>>();

    for (const doc of documents) {
        const years = bySection.get(doc.section) ?? new Map<null | number, Array<T>>();

        const list = years.get(doc.year) ?? [];

        list.push(doc);

        years.set(doc.year, list);

        bySection.set(doc.section, years);
    }

    return [...bySection.entries()]
        .sort(([a], [b]) => sectionRank(a) - sectionRank(b) || a.localeCompare(b))
        .map(([section, years]) => ({
            count: [...years.values()].reduce((sum, list) => sum + list.length, 0),
            section,
            years: [...years.entries()]
                .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b - a))
                .map(([year, list]) => ({ documents: list, year })),
        }));
}

/** Where a row opens: the stored copy (signed), else the page it was found on (a link-only webcast row). */
export function documentHref(doc: Pick<EarningsCompanyDocument, "source_url" | "url">) {
    return doc.url ?? doc.source_url;
}

/** A search hit's file at its page: `#page=<n>` only on a PDF (the signed URL's path ends in `.pdf`). */
export function documentPageHref(url: string, page: null | number) {
    if (page === null) return url;

    try {
        return new URL(url).pathname.toLowerCase().endsWith(".pdf") ? `${url}#page=${page}` : url;
    }
    catch {
        return url;
    }
}

/** The earliest expiry among the loaded presigned links (one refetch renews every page). */
export function earliestExpiry(documents: ReadonlyArray<{ expires_at: null | string }>) {
    const expiries = documents.map(doc => doc.expires_at).filter((at): at is string => at !== null);

    return expiries.length > 0 ? expiries.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b)) : null;
}

export type DocumentPage = { n: number; text: string; title: null | string };

/** The pages of a pages JSON (`{ pages: [{ n, title, text, sections }] }`); anything else → `[]`. */
export function pagesOf(pagesJson: JsonValue | undefined): Array<DocumentPage> {
    if (!pagesJson || typeof pagesJson !== "object" || Array.isArray(pagesJson)) return [];

    const pages = pagesJson.pages;

    if (!Array.isArray(pages)) return [];

    return pages.flatMap((page, index) => {
        if (!page || typeof page !== "object" || Array.isArray(page)) return [];

        const text = typeof page.text === "string" ? page.text : "";

        return [{
            n: typeof page.n === "number" ? page.n : index + 1,
            text,
            title: typeof page.title === "string" && page.title.trim() ? page.title : null,
        }];
    });
}
