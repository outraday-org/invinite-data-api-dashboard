import { z } from "zod";

import type { NewsDevelopment, NewsItemPublic, NewsKind, NewsPublication } from "@/lib/api/types";

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

/** `edgar` → "SEC EDGAR", `ir:<host>` → "Company newsroom (<host>)"; anything else as stored. */
export function sourceLabel(sourceId: string) {
    if (sourceId === "edgar") return NEWS_SOURCE_LABELS.edgar;

    if (sourceId.startsWith(IR_SOURCE_PREFIX)) return `${NEWS_SOURCE_LABELS.ir} (${sourceId.slice(IR_SOURCE_PREFIX.length)})`;

    return sourceId;
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

const newsSearchSchema = z.object({
    category: z.string().trim().min(1).optional().catch(undefined),
    earnings: z.enum(["true", "false"]).optional().catch(undefined),
    from: z.iso.date().optional().catch(undefined),
    item: z.uuid().optional().catch(undefined),
    kind: z.enum(NEWS_KINDS as [NewsKind, ...Array<NewsKind>]).optional().catch(undefined),
    live: z.boolean().optional().catch(undefined),
    /** "Company-published": items the company published itself (`publisher=<cik>`), company scope only. */
    published: z.boolean().optional().catch(undefined),
    pubType: z.enum(NEWS_PUBLICATION_TYPES as [string, ...Array<string>]).optional().catch(undefined),
    scope: z.enum(["company", "market"]).optional().catch(undefined),
    source: z.enum(NEWS_SOURCES as [NewsSourceFilter, ...Array<NewsSourceFilter>]).optional().catch(undefined),
    tag: z.string().trim().min(1).optional().catch(undefined),
    to: z.iso.date().optional().catch(undefined),
    topic: z.enum(NEWS_TOPICS as [NewsTopic, ...Array<NewsTopic>]).optional().catch(undefined),
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

function firstSourceKind(sourceId: string): NewsSourceFilter | null {
    if (sourceId === "edgar") return "edgar";

    return sourceId.startsWith(IR_SOURCE_PREFIX) ? "ir" : null;
}

/**
 * The list's filters applied to one item (the live feed: `news.live` filters only tickers, kinds, sources and earnings,
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
