import { formatMoneyCompact, formatNumber } from "@/lib/format";

import type { GuidanceFlashFrame, KeywordHitFrame } from "./ws-frames";

/**
 * "Live highlights" of a call (backend `tasks/data-api-dashboard` O4): the `keyword_hit` frames of the page's watch list
 * and the `guidance_flash` frames of the call, as a PURE reducer. A hit is kept once (its layer, seq / start and keyword:
 * a re-subscribe that replays a final repeats nothing); a flash is one row per metric / period and a restatement (a
 * higher `revision`) replaces it. Neither frame is ever thrown on: the parser already dropped malformed ones.
 */

export type KeywordHighlight = {
    readonly key: string;
    readonly keyword: string;
    readonly layer: "final" | "live";
    readonly speakerName: null | string;
    /** Live: call ms (from `call_t0`); final: ms from the recording's start. */
    readonly startMs: null | number;
    readonly text: string;
};

export type GuidanceHighlight = {
    readonly key: string;
    readonly metric: string;
    readonly periodLabel: string;
    readonly revision: number;
    readonly sourceSentence: string;
    readonly startMs: number;
    /** "$94B–$96B", "12%", "1.2M shares". */
    readonly value: string;
};

export type LiveHighlightsState = {
    readonly guidance: ReadonlyArray<GuidanceHighlight>;
    readonly keywords: ReadonlyArray<KeywordHighlight>;
};

export const INITIAL_LIVE_HIGHLIGHTS: LiveHighlightsState = { guidance: [], keywords: [] };

export type LiveHighlightsAction
    = | { readonly frame: GuidanceFlashFrame; readonly kind: "guidance_flash" }
        | { readonly frame: KeywordHitFrame; readonly kind: "keyword_hit" };

function formatAmount(value: number, unit: null | string, currency: null | string): string {
    if (unit === "percent") return `${formatNumber(value, { maximumFractionDigits: 2 })}%`;

    if (currency !== null) return formatMoneyCompact(value, currency);

    const number = formatNumber(value, { maximumFractionDigits: 2, notation: Math.abs(value) >= 1e6 ? "compact" : "standard" });

    return unit === null ? number : `${number} ${unit}`;
}

/** A flash's numbers as one value: the range `low–high`, else the point, else what bound was said ("≥ …" / "≤ …"). */
export function formatGuidanceValue(frame: Pick<GuidanceFlashFrame, "currency" | "high" | "low" | "point" | "unit">): string {
    const amount = (value: number) => formatAmount(value, frame.unit, frame.currency);

    if (frame.low !== null && frame.high !== null) return `${amount(frame.low)}–${amount(frame.high)}`;

    if (frame.point !== null) return amount(frame.point);

    if (frame.low !== null) return `≥ ${amount(frame.low)}`;

    if (frame.high !== null) return `≤ ${amount(frame.high)}`;

    return "—";
}

export function liveHighlightsReducer(state: LiveHighlightsState, action: LiveHighlightsAction): LiveHighlightsState {
    if (action.kind === "keyword_hit") {
        const { frame } = action;

        const key = `${frame.layer}-${frame.seq ?? frame.start_ms ?? "?"}-${frame.keyword.toLowerCase()}`;

        if (state.keywords.some(hit => hit.key === key)) return state;

        const hit: KeywordHighlight = {
            key,
            keyword: frame.keyword,
            layer: frame.layer,
            speakerName: frame.speaker_name,
            startMs: frame.start_ms,
            text: frame.text,
        };

        return { ...state, keywords: [...state.keywords, hit] };
    }

    const { frame } = action;

    const key = `${frame.metric_normalized}|${frame.period_label}`;

    const current = state.guidance.find(flash => flash.key === key);

    if (current !== undefined && current.revision >= frame.revision) return state;

    const flash: GuidanceHighlight = {
        key,
        metric: frame.metric,
        periodLabel: frame.period_label,
        revision: frame.revision,
        sourceSentence: frame.source_sentence,
        startMs: frame.start_ms,
        value: formatGuidanceValue(frame),
    };

    return { ...state, guidance: [...state.guidance.filter(other => other.key !== key), flash] };
}

export type LiveHighlight = (GuidanceHighlight & { kind: "guidance" }) | (KeywordHighlight & { kind: "keyword" });

/** Both kinds in call order (a hit without a time last). */
export function liveHighlightList(state: LiveHighlightsState): Array<LiveHighlight> {
    const all: Array<LiveHighlight> = [
        ...state.keywords.map(hit => ({ ...hit, kind: "keyword" as const })),
        ...state.guidance.map(flash => ({ ...flash, kind: "guidance" as const })),
    ];

    return all.sort((a, b) => (a.startMs ?? Number.POSITIVE_INFINITY) - (b.startMs ?? Number.POSITIVE_INFINITY));
}

/** The watch list as the user typed it: comma separated, trimmed, 2–64 characters, at most 20, no repeats. */
export function parseKeywords(input: string): Array<string> {
    const seen = new Set<string>();

    const keywords: Array<string> = [];

    for (const part of input.split(",")) {
        const keyword = part.trim().replace(/\s+/g, " ");

        if (keyword.length < 2 || keyword.length > 64 || seen.has(keyword.toLowerCase())) continue;

        seen.add(keyword.toLowerCase());

        keywords.push(keyword);

        if (keywords.length === 20) break;
    }

    return keywords;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `text` cut into plain and marked pieces: every whole-word occurrence of a keyword (case-insensitive, with the stem
 * endings the API's `stem` match allows: s / es / ed / ing / 's). No keywords = the text as one piece.
 */
export function splitByKeywords(text: string, keywords: ReadonlyArray<string>): Array<{ marked: boolean; text: string }> {
    if (keywords.length === 0 || text.length === 0) return [{ marked: false, text }];

    const pattern = new RegExp(`\\b(?:${keywords.map(escapeRegExp).join("|")})(?:s|es|ed|ing|'s)?\\b`, "gi");

    const pieces: Array<{ marked: boolean; text: string }> = [];

    let at = 0;

    for (const match of text.matchAll(pattern)) {
        if (match.index > at) pieces.push({ marked: false, text: text.slice(at, match.index) });

        pieces.push({ marked: true, text: match[0] });

        at = match.index + match[0].length;
    }

    if (at < text.length) pieces.push({ marked: false, text: text.slice(at) });

    return pieces;
}
