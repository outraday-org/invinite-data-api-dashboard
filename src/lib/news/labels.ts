import { z } from "zod";

import type { NewsDevelopment, NewsItemPublic, NewsKind, NewsPublication, V2AnnouncementTopic } from "@/lib/api/types";
import type { ListsEvery } from "@/lib/earnings/labels";

import { optionalDay, optionalEnum } from "@/lib/url-state";

/**
 * Labels, the route's search params and the pure filter / merge rules of the News page (backend earnings
 * tasks/inhouse-news-pipeline task 17). Value sets mirror IDA `src/lib/news/constants.ts` (compile-time exhaustive over
 * the generated unions where the spec has one) — change with IDA. Wire services are never a source (owner
 * 2026-10-28): the only sources are SEC EDGAR and the companies' own newsrooms.
 */

export const NEWS_KIND_LABELS: Record<NewsKind, string> = {
    call_announcement: "Call announcement",
    capital_markets: "Capital markets",
    dividend: "Dividend",
    earnings_results: "Earnings results",
    event_announcement: "Event announcement",
    guidance: "Guidance",
    legal_spam: "Legal notice",
    m_and_a: "M&A",
    management_change: "Management change",
    material_agreement: "Material agreement",
    other: "Other",
    promo: "Promotional",
    results_date: "Results date",
};

export const NEWS_KINDS = Object.keys(NEWS_KIND_LABELS) as Array<NewsKind>;

type NewsTopic = NewsItemPublic["topics"][number];

export const NEWS_TOPIC_LABELS: Record<NewsTopic, string> = {
    availability: "Availability",
    capacity_expansion: "Capacity expansion",
    customer_contract: "Customer contract",
    other: "Other",
    partnership: "Partnership",
    product_launch: "Product launch",
    product_update: "Product update",
    regulatory: "Regulatory",
    research: "Research",
};

export const NEWS_TOPICS = Object.keys(NEWS_TOPIC_LABELS) as Array<NewsTopic>;

/** The `/v1/announcements` topic filter (an announcement is never `other`); labels = `NEWS_TOPIC_LABELS`. */
export const ANNOUNCEMENT_TOPICS = [
    "product_launch",
    "product_update",
    "availability",
    "partnership",
    "customer_contract",
    "capacity_expansion",
    "regulatory",
    "research",
] as const satisfies ReadonlyArray<V2AnnouncementTopic>;

// Compile-time: a topic the API adds fails here until it is listed above.
export const ANNOUNCEMENT_TOPICS_COMPLETE: ListsEvery<V2AnnouncementTopic, (typeof ANNOUNCEMENT_TOPICS)[number]> = true;

/** `date_precision` of an announcement's effective dates. */
export const DATE_PRECISION_LABELS: Record<NewsDevelopment["date_precision"], string> = {
    day: "day",
    month: "month",
    quarter: "quarter",
    unknown: "precision unknown",
    year: "year",
};

/** The `source` filter: the item's FIRST source. */
export const NEWS_SOURCE_LABELS = { edgar: "SEC EDGAR", ir: "Company newsroom" } as const;

export type NewsSourceFilter = keyof typeof NEWS_SOURCE_LABELS;

export const NEWS_SOURCES = Object.keys(NEWS_SOURCE_LABELS) as Array<NewsSourceFilter>;

/** `publication_type` of an issuer publication (the spec types it as a string; `unknown` is not a filter value). */
export const NEWS_PUBLICATION_TYPE_LABELS: Record<string, string> = {
    company_blog: "Company blog",
    company_update: "Company update",
    press_release: "Press release",
};

export const NEWS_PUBLICATION_TYPES = Object.keys(NEWS_PUBLICATION_TYPE_LABELS);

export const CLAIM_STATUS_LABELS: Record<NewsDevelopment["claim_status"], string> = {
    announced: "Announced",
    available: "Available",
    cancelled: "Cancelled",
    completed: "Completed",
    planned: "Planned",
    unknown: "Status unknown",
};

const IR_SOURCE_PREFIX = "ir:";

/** `edgar`, or a company newsroom: v2's `ir` (the host apart) or a publication's `ir:<host>`. */
function firstSourceKind(sourceId: string): NewsSourceFilter | null {
    if (sourceId === "edgar") return "edgar";

    return sourceId === "ir" || sourceId.startsWith(IR_SOURCE_PREFIX) ? "ir" : null;
}

/**
 * An item's first source: `edgar` → "SEC EDGAR", `ir` → "Company newsroom (<host>)" (v2 states the id `ir` and the
 * newsroom host apart; a publication's `source_id` still reads `ir:<host>`); anything else as stored.
 */
export function sourceLabel(source: { host?: null | string; id: string }) {
    const kind = firstSourceKind(source.id);

    if (kind === "edgar") return NEWS_SOURCE_LABELS.edgar;

    if (kind === "ir") {
        const host = source.host ?? (source.id.startsWith(IR_SOURCE_PREFIX) ? source.id.slice(IR_SOURCE_PREFIX.length) : null);

        return host ? `${NEWS_SOURCE_LABELS.ir} (${host})` : NEWS_SOURCE_LABELS.ir;
    }

    return source.id;
}

export function publicationTypeLabel(value: string) {
    return NEWS_PUBLICATION_TYPE_LABELS[value] ?? value.replaceAll("_", " ");
}

function publisherName(publication: NewsPublication) {
    return publication.publisher.name ?? publication.publisher.symbol ?? (publication.publisher.cik ? `CIK ${publication.publisher.cik}` : null);
}

/**
 * "Published by" = the companies of the item's verified issuer publications — never a company it merely mentions
 * (`symbols`), never the first source. Empty for an item no issuer published (e.g. an SEC filing only).
 */
export function publishedBy(item: Pick<NewsItemPublic, "publications">): Array<string> {
    return [...new Set(item.publications.map(publisherName).filter((name): name is string => name !== null))];
}

/** The list orders of a page (`?sort=` / `?aSort=`; absent = newest first). */
export const NEWS_ORDER_LABELS = { newest: "Newest first", oldest: "Oldest first" } as const;

const newsSearchSchema = z.object({
    /** Announcements: announced from / to (UTC days). */
    aFrom: optionalDay(),
    /** Announcements: oldest first (absent = newest first). */
    aSort: z.literal("oldest").optional().catch(undefined),
    aTo: optionalDay(),
    /** Announcements: one topic. */
    aTopic: optionalEnum(ANNOUNCEMENT_TOPICS),
    category: z.string().trim().min(1).optional().catch(undefined),
    // A hand-typed / linked `?earnings=true` arrives as a boolean (the router parses JSON values); the select writes the
    // string, which the router keeps quoted (`%22true%22`) to round-trip it. Both read the same.
    earnings: z.preprocess(value => (typeof value === "boolean" ? String(value) : value), z.enum(["true", "false"])).optional().catch(undefined),
    /** Announcements: effective on or after this day (`effective_from.gte`). */
    effFrom: optionalDay(),
    /** Announcements: effective until on or before this day (`effective_to.lte`). */
    effTo: optionalDay(),
    /** The news linked to one event (an event id, `/v1/news?event=`). */
    event: z.uuid().optional().catch(undefined),
    from: z.iso.date().optional().catch(undefined),
    item: z.uuid().optional().catch(undefined),
    kind: z.enum(NEWS_KINDS as [NewsKind, ...Array<NewsKind>]).optional().catch(undefined),
    live: z.boolean().optional().catch(undefined),
    /** "Company-published": items the company published itself (`publisher=<cik>`), company scope only. */
    published: z.boolean().optional().catch(undefined),
    pubType: z.enum(NEWS_PUBLICATION_TYPES as [string, ...Array<string>]).optional().catch(undefined),
    scope: z.enum(["company", "market"]).optional().catch(undefined),
    /** Oldest first (absent = newest first, the API's default). */
    sort: z.literal("oldest").optional().catch(undefined),
    source: z.enum(NEWS_SOURCES as [NewsSourceFilter, ...Array<NewsSourceFilter>]).optional().catch(undefined),
    tag: z.string().trim().min(1).optional().catch(undefined),
    to: z.iso.date().optional().catch(undefined),
    topic: z.enum(NEWS_TOPICS as [NewsTopic, ...Array<NewsTopic>]).optional().catch(undefined),
    /** `announcements` = the Announcements tab (absent = the news list). */
    view: z.literal("announcements").optional().catch(undefined),
});

export type NewsSearch = z.infer<typeof newsSearchSchema>;

/**
 * `validateSearch` of `/$ticker/news`: every field optional, an invalid value falls back to none. The publisher-only
 * filters (`published`, `pubType`, `category`, `tag`) are dropped in the market scope; `category` / `tag` need one
 * publisher (the API's rule), so they are dropped without `published`.
 */
export function validateNewsSearch(search: Record<string, unknown>): NewsSearch {
    const parsed = newsSearchSchema.parse(search);

    const companyPublished = parsed.scope !== "market" && parsed.published === true;

    return {
        ...parsed,
        category: companyPublished ? parsed.category : undefined,
        published: companyPublished ? true : undefined,
        pubType: companyPublished ? parsed.pubType : undefined,
        tag: companyPublished ? parsed.tag : undefined,
    };
}

/** `validateSearch` of `/news-feed`: the list filters, the live switch, the open item and `scope=market` (live only). */
const newsFeedSearchSchema = newsSearchSchema.pick({
    earnings: true,
    from: true,
    item: true,
    kind: true,
    live: true,
    scope: true,
    sort: true,
    source: true,
    to: true,
    topic: true,
});

export type NewsFeedSearch = z.infer<typeof newsFeedSearchSchema>;

export function validateNewsFeedSearch(search: Record<string, unknown>): NewsFeedSearch {
    const parsed = newsFeedSearchSchema.parse(search);

    // `company` is the default scope: never written. The market scope has no REST list, so no order or window.
    if (parsed.scope !== "market") return { ...parsed, scope: undefined };

    return { ...parsed, from: undefined, sort: undefined, to: undefined };
}

/** What a list request and a live item are both filtered by (the request's own parameters, resolved). */
export type NewsFilters = {
    category?: string;
    earnings?: "false" | "true";
    kind?: NewsKind;
    publicationType?: string;
    /** Unpadded CIK of the "Company-published" publisher. */
    publisherCik?: string;
    source?: NewsSourceFilter;
    tag?: string;
    topic?: NewsTopic;
};

/**
 * The list's filters applied to one item (the live feed: the stream's `news` channel filters only tickers, kinds, sources and earnings,
 * so a pushed item is re-checked here before it joins the list). The scope (ticker / market) is the subscription's.
 */
export function matchesNewsFilters(item: NewsItemPublic, filters: NewsFilters): boolean {
    if (filters.kind && item.kind !== filters.kind) return false;

    if (filters.topic && !item.topics.includes(filters.topic)) return false;

    if (filters.source && firstSourceKind(item.source.id) !== filters.source) return false;

    if (filters.earnings && item.is_earnings_news !== (filters.earnings === "true")) return false;

    if (filters.publisherCik) {
        const cik = filters.publisherCik.replace(/^0+/, "");

        const own = item.publications.filter(p => p.publisher.cik?.replace(/^0+/, "") === cik);

        if (own.length === 0) return false;

        if (filters.publicationType && !own.some(p => p.publication_type === filters.publicationType)) return false;

        if (filters.category && !own.some(p => p.categories.some(c => c.label === filters.category || c.id === filters.category))) return false;

        if (filters.tag && !own.some(p => p.tags.some(t => t.label === filters.tag || t.id === filters.tag))) return false;
    }

    return true;
}

/** Live items on top of the listed pages: one row per id (the live copy wins), newest `published_at` first. */
export function mergeLiveItems(live: ReadonlyArray<NewsItemPublic>, listed: ReadonlyArray<NewsItemPublic>): Array<NewsItemPublic> {
    const seen = new Set<string>();

    const merged: Array<NewsItemPublic> = [];

    for (const item of [...live, ...listed]) {
        if (seen.has(item.id)) continue;

        seen.add(item.id);

        merged.push(item);
    }

    // A pushed item is new, not necessarily newer than every listed one: re-sort by publication time (stable).
    return merged.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}

/** The publisher's own newsroom categories / tags seen in the loaded items (the "Company-published" pickers). */
export function issuerLabels(items: ReadonlyArray<NewsItemPublic>, publisherCik: string, field: "categories" | "tags"): Array<string> {
    const cik = publisherCik.replace(/^0+/, "");

    const labels = new Set<string>();

    for (const item of items) {
        for (const publication of item.publications) {
            if (publication.publisher.cik?.replace(/^0+/, "") !== cik) continue;

            for (const entry of publication[field]) labels.add(entry.label);
        }
    }

    return [...labels].sort((a, b) => a.localeCompare(b));
}

/** "10-K · 0001045810-26-000012" for an SEC filing's attribution, else null. */
export function edgarLabel(edgar: NewsItemPublic["attribution"]["edgar"]) {
    if (!edgar) return null;

    return [edgar.form, edgar.accession].filter(Boolean).join(" · ");
}
