import type { FreshnessReason, LicenseRight, LicenseTier, ProductFamily } from "@/lib/api/types";

/** Display labels of the API's product families (status and licensing pages). */
export const FAMILY_LABELS: Record<ProductFamily, string> = {
    company: "Company",
    earnings_calls: "Earnings calls",
    financials: "Financials",
    insider_trades: "Insider trades",
    institutional_ownership: "Institutional ownership",
    ipos: "IPOs",
    market: "Market",
    metadata: "Metadata",
    sec_filings: "SEC filings",
    websocket: "WebSocket",
};

/**
 * The measured families in their fixed colour order: the n-th family always owns `--series-n`, so a
 * family keeps its colour whatever the filter or ranking. `metadata` (9th) has no categorical slot.
 */
export const PRODUCT_FAMILIES = [
    "company",
    "financials",
    "sec_filings",
    "insider_trades",
    "institutional_ownership",
    "ipos",
    "market",
    "earnings_calls",
    "metadata",
] as const satisfies ReadonlyArray<ProductFamily>;

const CATEGORICAL_SLOTS = 8;

export type SeriesStyle = {
    color: string;
    dashed: boolean;
};

/** The chart colour of a family: its fixed `--series-N` slot, muted + dashed beyond the eighth. */
export function familySeriesStyle(family: ProductFamily): SeriesStyle {
    const index = PRODUCT_FAMILIES.findIndex(item => item === family);

    if (index < 0 || index >= CATEGORICAL_SLOTS) return { color: "var(--muted-foreground)", dashed: true };

    return { color: `var(--series-${index + 1})`, dashed: false };
}

const FAMILY_LABEL_LOOKUP: Partial<Record<string, string>> = FAMILY_LABELS;

/** A family's label; a family this dashboard does not know yet shows its raw key. */
export function familyLabel(family: string) {
    return FAMILY_LABEL_LOOKUP[family] ?? family;
}

export const FRESHNESS_REASON_LABELS: Record<FreshnessReason, string> = {
    no_timestamp: "no ingest timestamp",
    not_measured: "not measured yet",
    unavailable: "unavailable",
};

export const RIGHT_LABELS: Record<LicenseRight, string> = {
    audio: "Audio",
    display: "Display",
    rag: "RAG",
    redistribute: "Redistribute",
    resell: "Resell",
    train: "Train",
};

export const LICENSE_TIERS = ["free", "lite", "standard", "pro"] as const satisfies ReadonlyArray<LicenseTier>;

export const TIER_LABELS: Record<LicenseTier, string> = {
    free: "Free",
    lite: "Lite",
    pro: "Pro",
    standard: "Standard",
};

/** The earnings latency chart's series (speech = the segment's own end time, as the API measures it). */
export const LATENCY_SERIES_LABELS = {
    firstSegment: "speech → live segment",
    keywordHit: "speech → keyword hit",
} as const;

/** The caveat of every keyword-hit latency number: IDA's own clock, not the subscriber's. */
export const KEYWORD_HIT_LATENCY_NOTE = "measured inside the API process, excludes the client's network";

const EM_DASH = "—";

/** A 0–1 ratio as a percent with `digits` decimals; "—" when unknown. */
export function formatRatioPercent(value: null | number | undefined, digits = 2) {
    if (value === null || value === undefined || !Number.isFinite(value)) return EM_DASH;

    return `${(value * 100).toFixed(digits)}%`;
}

/** Milliseconds as "123 ms"; "—" when unknown. */
export function formatMs(value: null | number | undefined) {
    if (value === null || value === undefined || !Number.isFinite(value)) return EM_DASH;

    return `${Math.round(value).toLocaleString("en")} ms`;
}

/** Seconds with one decimal ("12.5 s"); "—" when unknown. */
export function formatSeconds(value: null | number | undefined) {
    if (value === null || value === undefined || !Number.isFinite(value)) return EM_DASH;

    return `${value.toFixed(1)} s`;
}

/** Hours since the newest ingest ("3.2 h", "4.5 d" past two days); "—" when unknown. */
export function formatAgeHours(hours: null | number | undefined) {
    if (hours === null || hours === undefined || !Number.isFinite(hours)) return EM_DASH;

    if (hours >= 48) return `${(hours / 24).toFixed(1)} d`;

    return `${hours.toFixed(1)} h`;
}

const TOP_SCOPE = /^top(\d+)$/;

/**
 * The earnings-call coverage scope in words: `top500` → "the top 500 US companies by market cap",
 * `all` → "all US-listed companies"; null for `unknown` or any other value.
 */
export function describeEarningsScope(scope: string) {
    if (scope === "all") return "all US-listed companies";

    const match = TOP_SCOPE.exec(scope);

    if (!match) return null;

    return `the top ${Number(match[1]).toLocaleString("en")} US companies by market cap`;
}

/** The current UTC day (`YYYY-MM-DD`) of an ISO timestamp, else null. */
export function utcDayOf(timestamp: string) {
    const parsed = new Date(timestamp);

    if (Number.isNaN(parsed.getTime())) return null;

    return parsed.toISOString().slice(0, 10);
}

/** An x-axis day label: "MM-DD", or "today (partial)" for the current (incomplete) UTC day. */
export function dayTickLabel(day: string, todayUtc: null | string) {
    if (todayUtc !== null && day === todayUtc) return "today (partial)";

    return day.slice(5);
}

const UTC_DATE_TIME = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** An ISO timestamp in UTC ("Oct 10, 2026, 8:15 AM UTC"): stable between server and browser render. */
export function formatUtcDateTime(timestamp: null | string | undefined) {
    if (!timestamp) return EM_DASH;

    const parsed = new Date(timestamp);

    if (Number.isNaN(parsed.getTime())) return timestamp;

    return `${UTC_DATE_TIME.format(parsed)} UTC`;
}

const VENDOR_LABELS: Record<string, string> = {
    all: "All vendors",
    choruscall: "Chorus Call",
    eqs: "EQS",
    euronext: "Euronext",
    globalmeet: "GlobalMeet",
    investis: "Investis",
    knowledgevision: "KnowledgeVision",
    notified: "Notified",
    on24: "ON24",
    openexchange: "Open Exchange",
    q4events: "Q4 Events",
    unknown: "Unknown vendor",
    viavid: "ViaVid",
    x: "X",
    zoom: "Zoom",
    zoom_events: "Zoom Events",
};

/** A webcast vendor's display name; an unlisted vendor shows as sent. */
export function vendorLabel(vendor: string) {
    return VENDOR_LABELS[vendor] ?? vendor;
}

/** "sec_filings_index" → "Sec filings index" (dataset names of the freshness table). */
export function datasetLabel(dataset: string) {
    const words = dataset.replaceAll("_", " ").replaceAll("-", " ").trim();

    return words.length > 0 ? `${words[0].toUpperCase()}${words.slice(1)}` : dataset;
}
