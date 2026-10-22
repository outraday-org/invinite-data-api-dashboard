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

/**
 * The spine folders of the company document tree (IDA `ASSET_GROUP_CATEGORIES` in `src/lib/earnings/asset-groups.ts`,
 * from the pipeline's `asset-groups.ts`), in tree order. Change with IDA.
 */
export const ASSET_GROUP_CATEGORIES = [
    "earnings",
    "events",
    "news",
    "reports",
    "presentations",
    "governance",
    "esg",
    "shareholder",
    "other",
] as const;

export type AssetGroupCategory = (typeof ASSET_GROUP_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<AssetGroupCategory, string> = {
    earnings: "Earnings",
    esg: "ESG",
    events: "Events",
    governance: "Governance",
    news: "News",
    other: "Other",
    presentations: "Presentations",
    reports: "Reports",
    shareholder: "Shareholder",
};

/** The tree's bucket for documents the pipeline has not placed yet (`category` null), after every category. */
export const UNPLACED_CATEGORY = "unplaced";

export const categoryLabel = (category: string) =>
    category === UNPLACED_CATEGORY
        ? "Not yet placed"
        : (CATEGORY_LABELS as Record<string, string | undefined>)[category] ?? documentKindLabel(category);

// Every field optional: a bare `/$ticker/documents` link shows the whole library; an invalid value
// falls back to "no filter" instead of failing the route (as the calendar filters).
const documentsSearchSchema = z.object({
    category: z.enum(ASSET_GROUP_CATEGORIES).optional().catch(undefined),
    kind: z.enum(COMPANY_DOCUMENT_KINDS).optional().catch(undefined),
    section: z.enum(IR_SECTION_KINDS).optional().catch(undefined),
    year: z.coerce.number().int().min(1990).max(2100).optional().catch(undefined),
});

export type DocumentsSearch = z.infer<typeof documentsSearchSchema>;

/** `validateSearch` of the Documents route. */
export function validateDocumentsSearch(search: Record<string, unknown>): DocumentsSearch {
    return documentsSearchSchema.parse(search);
}

type TreeDocument = {
    category: null | string;
    group: null | string;
    group_label: null | string;
    section: string;
    year: null | number;
};

export type DocumentFolder<T extends TreeDocument> = { documents: Array<T>; key: string; label: string };

export type DocumentCategoryGroup<T extends TreeDocument> = {
    category: string;
    count: number;
    folders: Array<DocumentFolder<T>>;
};

const categoryRank = (category: string) => {
    const index = (ASSET_GROUP_CATEGORIES as ReadonlyArray<string>).indexOf(category);

    if (index !== -1) return index;

    return category === UNPLACED_CATEGORY ? ASSET_GROUP_CATEGORIES.length + 1 : ASSET_GROUP_CATEGORIES.length;
};

const DATED_SEGMENT = /^(?:fy|cy|q)?\d/;

/**
 * Folder order inside a category (the pipeline's `compareGroupPaths`): dated segments (`fy2027`, `q2`, `2025`,
 * `09-10-…`) newest first, named ones A–Z, `undated` last; a parent before its children.
 */
export function compareFolderKeys(a: string, b: string) {
    const left = a.split("/");

    const right = b.split("/");

    for (let index = 0; index < Math.min(left.length, right.length); index++) {
        const x = left[index];

        const y = right[index];

        if (x === y) continue;

        if (x === "undated") return 1;

        if (y === "undated") return -1;

        if (DATED_SEGMENT.test(x) && DATED_SEGMENT.test(y)) return y.localeCompare(x);

        return x.localeCompare(y);
    }

    return left.length - right.length;
}

/** A document's folder: its `group`, else (not placed yet) its IR section and year. */
function folderOf(doc: TreeDocument) {
    if (doc.group) return { key: doc.group, label: doc.group_label ?? doc.group };

    return {
        key: `${doc.section}/${doc.year ?? "undated"}`,
        label: `${sectionLabel(doc.section)} · ${doc.year ?? "Undated"}`,
    };
}

/**
 * Category → folder tree of the loaded documents, by the API's document tree (`category`, `group`, `group_label`):
 * categories in `ASSET_GROUP_CATEGORIES` order (an unknown one after them, documents not placed yet last, by IR
 * section and year), folders by `compareFolderKeys`; within a folder the API's order is kept.
 */
export function groupDocumentFolders<T extends TreeDocument>(documents: ReadonlyArray<T>): Array<DocumentCategoryGroup<T>> {
    const byCategory = new Map<string, Map<string, DocumentFolder<T>>>();

    for (const doc of documents) {
        const category = doc.category ?? UNPLACED_CATEGORY;

        const folders = byCategory.get(category) ?? new Map<string, DocumentFolder<T>>();

        const { key, label } = folderOf(doc);

        const folder = folders.get(key) ?? { documents: [], key, label };

        folder.documents.push(doc);

        folders.set(key, folder);

        byCategory.set(category, folders);
    }

    return [...byCategory.entries()]
        .sort(([a], [b]) => categoryRank(a) - categoryRank(b) || a.localeCompare(b))
        .map(([category, folders]) => ({
            category,
            count: [...folders.values()].reduce((sum, folder) => sum + folder.documents.length, 0),
            folders: [...folders.values()].sort((a, b) => compareFolderKeys(a.key, b.key)),
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
