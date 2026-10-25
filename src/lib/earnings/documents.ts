import { z } from "zod";

import type { EarningsCompanyDocument, EarningsEvent, JsonValue } from "@/lib/api/types";

import { callCalendarDate, eventLabel } from "@/lib/earnings/format";

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
    // The tree's text filter (client-side): trimmed, empty = no filter.
    q: z.string().trim().transform(q => q || undefined).optional().catch(undefined),
    section: z.enum(IR_SECTION_KINDS).optional().catch(undefined),
    year: z.coerce.number().int().min(1990).max(2100).optional().catch(undefined),
});

export type DocumentsSearch = z.infer<typeof documentsSearchSchema>;

/** `validateSearch` of the Documents route. */
export function validateDocumentsSearch(search: Record<string, unknown>): DocumentsSearch {
    return documentsSearchSchema.parse(search);
}

export type TreeDocument = {
    category: null | string;
    event_date: null | string;
    event_id: null | string;
    group: null | string;
    group_label: null | string;
    kind: string;
    section: null | string;
    title: null | string;
    year: null | number;
};

/** The events-list fields a call row needs. */
export type CallEvent = Pick<
    EarningsEvent,
    | "call_time_source"
    | "event_id"
    | "event_title"
    | "event_type"
    | "fiscal_quarter"
    | "fiscal_year"
    | "has_audio"
    | "has_documents"
    | "has_press_release"
    | "has_slides"
    | "has_transcript"
    | "scheduled_at"
    | "symbol"
>;

/** One call row of the tree: a call with a press release, slides or documents, at its folder (`callPlacement`). */
export type CallEntry = { date: string; event: CallEvent; key: string; label: string };

export type TreeNode<T> = {
    calls: Array<CallEntry>;
    children: Array<TreeNode<T>>;
    /** Documents + call rows in this subtree (under a text filter: the matches). */
    count: number;
    /** Documents whose folder is exactly `key`. */
    documents: Array<T>;
    /** The full path, e.g. `earnings/fy2027/q2`. */
    key: string;
    label: string;
    segment: string;
};

const categoryRank = (category: string) => {
    const index = (ASSET_GROUP_CATEGORIES as ReadonlyArray<string>).indexOf(category);

    if (index !== -1) return index;

    return category === UNPLACED_CATEGORY ? ASSET_GROUP_CATEGORIES.length + 1 : ASSET_GROUP_CATEGORIES.length;
};

const DATED_SEGMENT = /^(?:fy|cy|q)?\d/;

/** Sibling folder order: dated segments newest first (numeric-aware), named ones A–Z, `undated` last. */
function compareSegments(x: string, y: string) {
    if (x === y) return 0;

    if (x === "undated") return 1;

    if (y === "undated") return -1;

    if (DATED_SEGMENT.test(x) && DATED_SEGMENT.test(y)) return y.localeCompare(x, "en", { numeric: true });

    return x.localeCompare(y);
}

/**
 * Folder order inside a category (the pipeline's `compareGroupPaths`): dated segments (`fy2027`, `q2`, `2025`,
 * `09-10-…`) newest first, named ones A–Z, `undated` last; a parent before its children.
 */
export function compareFolderKeys(a: string, b: string) {
    const left = a.split("/");

    const right = b.split("/");

    for (let index = 0; index < Math.min(left.length, right.length); index++) {
        const order = compareSegments(left[index], right[index]);

        if (order !== 0) return order;
    }

    return left.length - right.length;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const titleCase = (slug: string) =>
    slug.split("-").filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

/**
 * A folder segment's label: the category at depth 0, `fy2027` → FY2027, `q2` → Q2, `cy2026` → 2026, `09-10-<slug>` →
 * "Sep 10 · Title Case Slug", `undated` → Undated, `faq` → FAQ, a year as is, a named folder in title case.
 */
export function segmentLabel(segment: string, depth: number) {
    if (depth === 0) return categoryLabel(segment);

    if (segment === "undated") return "Undated";

    if (segment === "faq") return "FAQ";

    const fiscal = /^fy(\d{4})$/.exec(segment);

    if (fiscal) return `FY${fiscal[1]}`;

    const quarter = /^q(\d)$/.exec(segment);

    if (quarter) return `Q${quarter[1]}`;

    const calendar = /^cy(\d{4})$/.exec(segment);

    if (calendar) return calendar[1];

    const day = /^(\d{2})-(\d{2})(?:-(.+))?$/.exec(segment);

    const month = day ? MONTHS[Number(day[1]) - 1] : undefined;

    if (day && month) return `${month} ${Number(day[2])}${day[3] ? ` · ${titleCase(day[3])}` : ""}`;

    if (/^\d{4}$/.test(segment)) return segment;

    return titleCase(segment);
}

/**
 * A document's folder path: its `group` split on `/` (the first segment is its category), else (not placed yet) the
 * "Not yet placed" bucket with one folder per IR section and year.
 */
function pathOf(doc: TreeDocument): Array<string> {
    if (doc.group) return doc.group.split("/");

    return [UNPLACED_CATEGORY, `${doc.section ?? "other"}-${doc.year ?? "undated"}`];
}

// The API's label of an event folder with a stored name: "May 18, 2025 · GTC Taipei 2025" (IDA
// `eventFolderDisplayLabel`); without one it reads "2025-05-18 · <slug>" (`groupLabel`), which never matches.
const STORED_EVENT_LABEL = new RegExp(`^(?:${MONTHS.join("|")}) \\d{1,2}, \\d{4} · (.+)$`);

const storedEventName = (label: null | string) => (label ? STORED_EVENT_LABEL.exec(label)?.[1].trim() : undefined);

/**
 * A folder's label from its path, its own documents and the loaded events' titles (`eventTitleMap`). An event folder
 * (`events/<YYYY>/<MM-DD>-<slug>`) reads "May 18 · <name>" — the stored name of a document's `group_label`, else the
 * `event_title` of a document's event, else the title-cased slug; a "Not yet placed" folder "IR section · year"; any
 * other folder its own segment (`segmentLabel`: "Q2", "2025", "Tax", never the parent's words again).
 */
export function folderLabel(
    path: ReadonlyArray<string>,
    docs: ReadonlyArray<TreeDocument>,
    eventTitles: ReadonlyMap<string, string>,
) {
    const depth = path.length - 1;

    const segment = path[depth];

    if (path[0] === UNPLACED_CATEGORY && depth === 1 && docs.length > 0) {
        return `${sectionLabel(docs[0].section ?? "other")} · ${docs[0].year ?? "Undated"}`;
    }

    const day = path[0] === "events" && depth === 2 ? /^(\d{2}-\d{2})-.+$/.exec(segment) : null;

    if (!day) return segmentLabel(segment, depth);

    const name = docs.map(doc => storedEventName(doc.group_label)).find(Boolean)
        ?? docs.map(doc => (doc.event_id ? eventTitles.get(doc.event_id) : undefined)).find(Boolean);

    return name ? `${segmentLabel(day[1], depth)} · ${name}` : segmentLabel(segment, depth);
}

/** `event_id` → trimmed `event_title` of the loaded events (the event-folder fallback of `folderLabel`). */
export function eventTitleMap(events: ReadonlyArray<Pick<CallEvent, "event_id" | "event_title">>) {
    const titles = new Map<string, string>();

    for (const event of events) {
        const title = event.event_title?.trim();

        if (title) titles.set(event.event_id, title);
    }

    return titles;
}

const pathLabels = (path: ReadonlyArray<string>) => path.map((segment, depth) => segmentLabel(segment, depth));

const includesQuery = (parts: ReadonlyArray<null | number | string | undefined>, query: string) =>
    parts.some(part => part !== null && part !== undefined && String(part).toLowerCase().includes(query));

/**
 * The tree's text filter, case-insensitive: title, kind label, folder path and its labels, the full `group_label`
 * ("Q2 FY2027", "May 18, 2025 · GTC Taipei 2025"), year and date. An empty query matches everything.
 */
export function matchesQuery(doc: TreeDocument, query: string) {
    const needle = query.trim().toLowerCase();

    if (!needle) return true;

    const path = pathOf(doc);

    return includesQuery(
        [
            doc.title,
            documentKindLabel(doc.kind),
            doc.group,
            doc.group_label,
            folderLabel(path, [doc], new Map()),
            ...pathLabels(path),
            doc.year,
            doc.event_date,
        ],
        needle,
    );
}

const NEW_YORK = "America/New_York";

/**
 * A call row's folder: the `group` of the call's loaded documents, else an earnings call with a fiscal period →
 * `earnings/fy<YYYY>/q<N>`, without one → `earnings/cy<YYYY>/<MM-DD>` (`callCalendarDate`: a timed call's New York
 * day, a date-only one's UTC date), any other event → `events/<YYYY>` (the pipeline's folder rules).
 */
export function callPlacement(event: CallEvent, documentGroups: ReadonlyMap<string, string>) {
    const group = documentGroups.get(event.event_id);

    if (group) return group;

    const day = callCalendarDate(event, NEW_YORK);

    if (event.event_type !== "earnings_call") return `events/${day.slice(0, 4)}`;

    if (event.fiscal_year !== null && event.fiscal_quarter !== null) return `earnings/fy${event.fiscal_year}/q${event.fiscal_quarter}`;

    return `earnings/cy${day.slice(0, 4)}/${day.slice(5)}`;
}

/**
 * The call rows of the loaded events: one per call with a press release, slides or documents, placed by
 * `callPlacement` (the `group` of its first loaded document, by `event_id`).
 */
export function callEntries(events: ReadonlyArray<CallEvent>, documents: ReadonlyArray<TreeDocument>): Array<CallEntry> {
    const documentGroups = new Map<string, string>();

    for (const doc of documents) {
        if (doc.event_id && doc.group && !documentGroups.has(doc.event_id)) documentGroups.set(doc.event_id, doc.group);
    }

    return events
        .filter(event => event.has_press_release || event.has_slides || event.has_documents)
        .map(event => ({
            date: callCalendarDate(event, NEW_YORK),
            event,
            key: callPlacement(event, documentGroups),
            label: eventLabel(event),
        }));
}

/**
 * The call rows the route's filters keep: none under a section or kind filter (a call row is no IR-section document of
 * a kind), a category filter on the folder's category, a year filter on the fiscal year (else the call's year).
 */
export function filterCallEntries(calls: ReadonlyArray<CallEntry>, search: DocumentsSearch) {
    if (search.section !== undefined || search.kind !== undefined) return [];

    return calls.filter(call =>
        (search.category === undefined || call.key.split("/")[0] === search.category)
        && (search.year === undefined || (call.event.fiscal_year ?? Number(call.date.slice(0, 4))) === search.year));
}

const callMatchesQuery = (call: CallEntry, query: string, folder: string) => {
    const needle = query.trim().toLowerCase();

    if (!needle) return true;

    const path = call.key.split("/");

    return includesQuery([call.label, call.date, call.key, folder, ...pathLabels(path)], needle);
};

type MutableNode<T> = TreeNode<T> & { byKey: Map<string, MutableNode<T>> };

function sortNodes<T>(nodes: Array<MutableNode<T>>, depth: number): Array<TreeNode<T>> {
    const sorted = depth === 0
        ? nodes.sort((a, b) => categoryRank(a.segment) - categoryRank(b.segment) || a.segment.localeCompare(b.segment))
        : nodes.sort((a, b) => compareSegments(a.segment, b.segment));

    return sorted.map(({ byKey, ...node }) => {
        const children = sortNodes([...byKey.values()], depth + 1);

        return {
            ...node,
            children,
            count: node.documents.length + node.calls.length + children.reduce((sum, child) => sum + child.count, 0),
        };
    });
}

/**
 * The company's whole document tree from the loaded rows: category → path segments → documents, any depth, split on
 * `group` (documents not placed yet last, by IR section and year), plus the call rows at their folders. Categories in
 * `ASSET_GROUP_CATEGORIES` order (an unknown one after them), folders newest first (`compareFolderKeys`); in a folder
 * the call rows first, then the documents in the API's order. A text `query` keeps the matches (`matchesQuery`) and
 * drops empty folders; counts are the matches then. Every folder is labelled by `folderLabel` from ALL its documents
 * (a filter never changes a label), a call-only folder too; a match on a folder's label keeps its rows.
 */
export function buildDocumentTree<T extends TreeDocument>(
    documents: ReadonlyArray<T>,
    calls: ReadonlyArray<CallEntry>,
    query: string,
    eventTitles: ReadonlyMap<string, string> = new Map(),
): Array<TreeNode<T>> {
    const roots = new Map<string, MutableNode<T>>();

    const docsByKey = new Map<string, Array<T>>();

    for (const doc of documents) {
        const key = pathOf(doc).join("/");

        const folder = docsByKey.get(key);

        if (folder) folder.push(doc);
        else docsByKey.set(key, [doc]);
    }

    const labelOf = (path: ReadonlyArray<string>) => folderLabel(path, docsByKey.get(path.join("/")) ?? [], eventTitles);

    const needle = query.trim().toLowerCase();

    const nodeAt = (path: ReadonlyArray<string>) => {
        let level = roots;

        let node: MutableNode<T> | undefined;

        path.forEach((segment, depth) => {
            const key = path.slice(0, depth + 1).join("/");

            node = level.get(segment);

            if (!node) {
                node = { byKey: new Map(), calls: [], children: [], count: 0, documents: [], key, label: labelOf(path.slice(0, depth + 1)), segment };

                level.set(segment, node);
            }

            level = node.byKey;
        });

        return node!;
    };

    for (const call of calls) {
        const path = call.key.split("/");

        if (callMatchesQuery(call, query, labelOf(path))) nodeAt(path).calls.push(call);
    }

    for (const doc of documents) {
        const path = pathOf(doc);

        if (matchesQuery(doc, query) || includesQuery([labelOf(path)], needle)) nodeAt(path).documents.push(doc);
    }

    return sortNodes([...roots.values()], 0);
}

/** The default open folders: every category, and the newest child at each level below it (its first path). */
export function defaultOpenKeys(tree: ReadonlyArray<TreeNode<unknown>>) {
    const keys = new Set<string>();

    for (const category of tree) {
        let node: TreeNode<unknown> | undefined = category;

        while (node) {
            keys.add(node.key);

            node = node.children.at(0);
        }
    }

    return keys;
}

/** Every folder of the tree (under a text filter all of them hold a match and open). */
export function allKeys(tree: ReadonlyArray<TreeNode<unknown>>): Array<string> {
    return tree.flatMap(node => [node.key, ...allKeys(node.children)]);
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
