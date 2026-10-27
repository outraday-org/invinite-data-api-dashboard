import type { EarningsGuidanceItem, EarningsSearchMode, HitMatch, MatchSpan } from "@/lib/api/types";

import { formatNumberEnCompact } from "@/lib/utils";

type Direction = EarningsGuidanceItem["direction"];

/** Labels of the API's normalized guidance / KPI vocabulary (`metric_normalized`). */
const METRIC_LABELS: Record<string, string> = {
    capex: "Capex",
    ebitda: "EBITDA",
    eps_gaap: "EPS (GAAP)",
    eps_non_gaap: "EPS (non-GAAP)",
    fcf: "Free cash flow",
    gross_margin: "Gross margin",
    net_income: "Net income",
    operating_income: "Operating income",
    operating_margin: "Operating margin",
    opex: "Opex",
    other: "Other",
    revenue: "Revenue",
    share_count: "Share count",
    tax_rate: "Tax rate",
};

const SEGMENT_PREFIX = "segment:";

/** "snake_case" / "kebab-case" → "Snake case". */
function sentenceCase(value: string) {
    const words = value.replaceAll("_", " ").replaceAll("-", " ").trim();

    return words.length === 0 ? words : words[0].toUpperCase() + words.slice(1);
}

/** "Revenue", "EPS (non-GAAP)", "Segment: qtl" for `segment:<slug>`; unknown values sentence-cased. */
export function metricLabel(normalized: null | string) {
    if (!normalized) return "—";

    if (normalized.startsWith(SEGMENT_PREFIX)) {
        return `Segment: ${normalized.slice(SEGMENT_PREFIX.length).replaceAll("-", " ")}`;
    }

    return METRIC_LABELS[normalized] ?? sentenceCase(normalized);
}

/** Direction chip: label + colour classes (the Badge variants have no green / amber). */
export const DIRECTION_STYLES: Record<Direction, { className: string; label: string }> = {
    lowered: { className: "bg-red-500/15 text-red-700 dark:text-red-400", label: "Lowered" },
    maintained: { className: "bg-muted text-muted-foreground", label: "Maintained" },
    new: { className: "bg-sky-500/15 text-sky-700 dark:text-sky-400", label: "New" },
    raised: { className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", label: "Raised" },
    unknown: { className: "border-border text-muted-foreground", label: "Unknown" },
    withdrawn: { className: "bg-amber-500/15 text-amber-700 dark:text-amber-400", label: "Withdrawn" },
};

export const PERIOD_KIND_LABELS: Record<EarningsGuidanceItem["period_kind"], string> = {
    fiscal_year: "Fiscal year",
    half: "Half year",
    other: "Other",
    quarter: "Quarter",
};

export const BASIS_LABELS: Record<EarningsGuidanceItem["basis"], string> = {
    gaap: "GAAP",
    non_gaap: "Non-GAAP",
    unknown: "—",
};

export const REVIEW_STATUS_LABELS: Record<EarningsGuidanceItem["review_status"], string> = {
    approved: "Approved",
    auto: "Auto",
    needs_review: "Needs review",
};

export const TONE_SHIFT_LABELS: Record<"more_cautious" | "more_positive" | "unchanged", string> = {
    more_cautious: "More cautious",
    more_positive: "More positive",
    unchanged: "Unchanged",
};

/** The four participant groups of the Participants tab, in display order. */
export const ROLE_GROUPS = ["management", "analyst", "operator", "unknown"] as const;

export type RoleGroup = (typeof ROLE_GROUPS)[number];

export const ROLE_GROUP_LABELS: Record<RoleGroup, string> = {
    analyst: "Analysts",
    management: "Management",
    operator: "Operator",
    unknown: "Unknown",
};

/** The pipeline's roles (`executive`, `ir_host`, `analyst`, `operator`, `unknown`) → a group. */
export function roleGroup(role: null | string): RoleGroup {
    switch (role) {
        case "analyst":
            return "analyst";
        case "executive":
        case "ir_host":
        case "management":
            return "management";
        case "operator":
            return "operator";
        default:
            return "unknown";
    }
}

const PARTICIPATION_KIND_LABELS: Record<string, string> = {
    ceo_absent: "CEO absent",
    ceo_no_questions: "CEO answered no questions",
    cfo_absent: "CFO absent",
    first_appearance: "First appearance",
    new_ceo: "New CEO",
    new_cfo: "New CFO",
    new_ir_host: "New IR host",
};

/** "New CFO", "First appearance"; unknown kinds sentence-cased. */
export function participationKindLabel(kind: string) {
    return PARTICIPATION_KIND_LABELS[kind] ?? sentenceCase(kind);
}

/**
 * The readable part of a participation event's `detail` (title, role, how many people);
 * ids (`priorEventUid`, `personIds`, …) are left out.
 */
export function participationDetailText(detail: null | Record<string, unknown>) {
    if (!detail) return "";

    const parts: Array<string> = [];

    if (typeof detail.title === "string" && detail.title.length > 0) parts.push(detail.title);

    if (typeof detail.role === "string" && detail.role.length > 0) parts.push(sentenceCase(detail.role));

    if (Array.isArray(detail.personIds) && detail.personIds.length > 1) {
        parts.push(`${detail.personIds.length} people`);
    }

    return parts.join(" · ");
}

/** A 0–1 share as "42.5%"; null / non-finite → "—". */
export function percent(share: null | number | undefined, digits = 1) {
    if (share === null || share === undefined || !Number.isFinite(share)) return "—";

    return `${(share * 100).toFixed(digits)}%`;
}

/** A number with up to `digits` decimals ("1,234.5"); null → "—". */
export function formatDecimal(value: null | number | undefined, digits = 2) {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";

    return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** A signed change ("+0.12", "−0.05", "0"); null → null (the caller shows "not available"). */
export function formatSigned(value: null | number | undefined, digits = 2) {
    if (value === null || value === undefined || !Number.isFinite(value)) return null;

    const abs = formatDecimal(Math.abs(value), digits);

    if (value > 0) return `+${abs}`;

    return value < 0 ? `−${abs}` : abs;
}

/**
 * One guidance figure in its unit: `usd` → "$9.70 B" (currency code when not USD), `pct` →
 * "45%", `shares` → "1.20 B shares", anything else plain. Null → "—".
 */
export function formatGuidanceValue(value: null | number, unit: null | string, currency: null | string) {
    if (value === null || !Number.isFinite(value)) return "—";

    const compact = Math.abs(value) >= 1000 ? formatNumberEnCompact(value) : formatDecimal(value);

    switch (unit) {
        case "pct":
            return `${formatDecimal(value)}%`;
        case "shares":
            return `${compact} shares`;
        case "usd":
            return !currency || currency === "USD" ? `$${compact}` : `${currency} ${compact}`;
        default:
            return currency ? `${currency} ${compact}` : compact;
    }
}

/** "low – high", one value when both are equal or only one is set; nothing → "—". */
export function formatGuidanceRange(item: Pick<EarningsGuidanceItem, "currency" | "high" | "low" | "unit">) {
    const { currency, high, low, unit } = item;

    if (low === null && high === null) return "—";

    if (low === null || high === null || low === high) {
        return formatGuidanceValue(low ?? high, unit, currency);
    }

    return `${formatGuidanceValue(low, unit, currency)} – ${formatGuidanceValue(high, unit, currency)}`;
}

export type HighlightPart = { match: boolean; text: string };

/**
 * Splits `text` into parts with the query's terms marked (case-insensitive). Plain string
 * comparison — the query is never turned into a regular expression. Terms shorter than two
 * characters are ignored; at each position the longest matching term wins.
 */
export function highlightTerms(text: string, query: string): Array<HighlightPart> {
    const terms = [...new Set(query.toLowerCase().split(/\s+/).filter(term => term.length >= 2))]
        .sort((a, b) => b.length - a.length);

    if (terms.length === 0 || text.length === 0) return text.length === 0 ? [] : [{ match: false, text }];

    const lower = text.toLowerCase();

    // A few characters change length when lower-cased ("İ"): positions would drift.
    if (lower.length !== text.length) return [{ match: false, text }];

    const parts: Array<HighlightPart> = [];

    let plainStart = 0;

    let index = 0;

    while (index < text.length) {
        const term = terms.find(candidate => lower.startsWith(candidate, index));

        if (!term) {
            index += 1;

            continue;
        }

        if (index > plainStart) parts.push({ match: false, text: text.slice(plainStart, index) });

        parts.push({ match: true, text: text.slice(index, index + term.length) });

        index += term.length;

        plainStart = index;
    }

    if (plainStart < text.length) parts.push({ match: false, text: text.slice(plainStart) });

    return parts;
}

/**
 * Splits `text` into parts with the server's match spans (`hit.match.spans`) marked. Spans are code-point offsets — an
 * emoji is one position, two UTF-16 units — so the text is indexed through `Array.from`. Out-of-range spans are
 * clamped, overlapping or touching ones merged.
 */
export function highlightSpans(text: string, spans: ReadonlyArray<MatchSpan>): Array<HighlightPart> {
    const points = Array.from(text);

    if (points.length === 0) return [];

    const ordered = spans
        .map(span => ({ end: Math.min(span.end, points.length), start: Math.max(span.start, 0) }))
        .filter(span => span.start < span.end)
        .sort((a, b) => a.start - b.start);

    const parts: Array<HighlightPart> = [];

    let cursor = 0;

    for (const span of ordered) {
        if (span.end <= cursor) continue;

        const start = Math.max(span.start, cursor);

        const marked = points.slice(start, span.end).join("");

        if (start > cursor) parts.push({ match: false, text: points.slice(cursor, start).join("") });

        const last = parts.at(-1);

        if (last?.match) last.text += marked;
        else parts.push({ match: true, text: marked });

        cursor = span.end;
    }

    if (cursor < points.length) parts.push({ match: false, text: points.slice(cursor).join("") });

    return parts;
}

/** The mode chips' labels; exhaustive over the API's mode enum (the server functions' zod enum is its keys). */
export const SEARCH_MODE_LABELS: Record<EarningsSearchMode, string> = {
    hybrid: "Hybrid",
    lexical: "Keyword",
    literal: "Exact",
    semantic: "Meaning",
};

export const SEARCH_MODES = Object.keys(SEARCH_MODE_LABELS) as [EarningsSearchMode, ...Array<EarningsSearchMode>];

/** A hit's match badge: the leg that found it; `both` = a hybrid hit both legs ranked. */
export const MATCH_TYPE_LABELS: Record<HitMatch["type"], string> = {
    hybrid: "both",
    lexical: "keyword",
    literal: "exact",
    semantic: "meaning",
};
