import { describe, expect, it } from "vitest";

import type { GuidanceFlashFrame, KeywordHitFrame } from "./ws-frames";

import {
    formatGuidanceValue,
    INITIAL_LIVE_HIGHLIGHTS,
    liveHighlightList,
    liveHighlightsReducer,
    parseKeywords,
    splitByKeywords,
} from "./live-highlights";

const SUB = { cik: "0000320193", conference_date: "2026-10-09T21:00:00.000Z", event_id: "e", subscription_id: "s", symbol: "AAPL" };

function hit(overrides: Partial<KeywordHitFrame> = {}): KeywordHitFrame {
    return {
        ...SUB,
        context_before: null,
        end_ms: 640_000,
        keyword: "tariffs",
        latency_ms: 8_000,
        layer: "live",
        seq: 41,
        speaker_label: "spk0",
        speaker_name: "Jane Doe",
        speaker_role: "executive",
        start_ms: 636_000,
        text: "Tariffs cost us 80 basis points.",
        type: "keyword_hit",
        ...overrides,
    };
}

function flash(overrides: Partial<GuidanceFlashFrame> = {}): GuidanceFlashFrame {
    return {
        ...SUB,
        currency: "USD",
        high: 96e9,
        low: 94e9,
        metric: "revenue",
        metric_normalized: "revenue",
        period_label: "Q4 FY2026",
        point: null,
        revision: 1,
        seq: 88,
        source_sentence: "Revenue between 94 and 96 billion.",
        start_ms: 1_220_000,
        type: "guidance_flash",
        unit: "USD",
        ...overrides,
    };
}

describe("liveHighlightsReducer", () => {
    it("keeps a hit once (a replayed final repeats nothing); another keyword or layer is its own hit", () => {
        let state = liveHighlightsReducer(INITIAL_LIVE_HIGHLIGHTS, { frame: hit(), kind: "keyword_hit" });

        const again = liveHighlightsReducer(state, { frame: hit({ keyword: "TARIFFS" }), kind: "keyword_hit" });

        expect(again).toBe(state);

        state = liveHighlightsReducer(state, { frame: hit({ keyword: "margin" }), kind: "keyword_hit" });

        state = liveHighlightsReducer(state, { frame: hit({ layer: "final", seq: null, start_ms: 630_000 }), kind: "keyword_hit" });

        expect(state.keywords.map(entry => `${entry.layer}:${entry.keyword}`)).toStrictEqual(["live:tariffs", "live:margin", "final:tariffs"]);
    });

    it("one flash per metric / period: a restatement replaces it, an older revision does not", () => {
        let state = liveHighlightsReducer(INITIAL_LIVE_HIGHLIGHTS, { frame: flash(), kind: "guidance_flash" });

        state = liveHighlightsReducer(state, { frame: flash({ high: 97e9, revision: 2 }), kind: "guidance_flash" });

        const stale = liveHighlightsReducer(state, { frame: flash({ revision: 1 }), kind: "guidance_flash" });

        expect(stale).toBe(state);

        expect(state.guidance).toHaveLength(1);

        expect(state.guidance[0].value).toBe("$94B–$97B");
    });

    it("lists both kinds in call order", () => {
        let state = liveHighlightsReducer(INITIAL_LIVE_HIGHLIGHTS, { frame: flash(), kind: "guidance_flash" });

        state = liveHighlightsReducer(state, { frame: hit(), kind: "keyword_hit" });

        state = liveHighlightsReducer(state, { frame: hit({ keyword: "capex", seq: null, start_ms: null }), kind: "keyword_hit" });

        expect(liveHighlightList(state).map(entry => entry.kind)).toStrictEqual(["keyword", "guidance", "keyword"]);
    });
});

describe("formatGuidanceValue", () => {
    it("formats a range, a point, a percent and a one-sided bound", () => {
        expect(formatGuidanceValue({ currency: "USD", high: 96e9, low: 94e9, point: null, unit: "USD" })).toBe("$94B–$96B");

        expect(formatGuidanceValue({ currency: null, high: null, low: null, point: 12.5, unit: "percent" })).toBe("12.5%");

        expect(formatGuidanceValue({ currency: null, high: null, low: 2_000_000, point: null, unit: "shares" })).toBe("≥ 2M shares");

        expect(formatGuidanceValue({ currency: null, high: null, low: null, point: null, unit: null })).toBe("—");
    });
});

describe("parseKeywords / splitByKeywords", () => {
    it("parses a comma list: trimmed, 2–64 characters, no repeats, at most 20", () => {
        expect(parseKeywords(" tariffs, a, Tariffs ,  free   cash flow ,")).toStrictEqual(["tariffs", "free cash flow"]);

        expect(parseKeywords(Array.from({ length: 30 }, (_, index) => `kw${index}`).join(","))).toHaveLength(20);
    });

    it("marks whole words with their stem endings, case-insensitively", () => {
        expect(splitByKeywords("Tariffs and tariff talk, not tariffing-free retariff.", ["tariff"])).toStrictEqual([
            { marked: true, text: "Tariffs" },
            { marked: false, text: " and " },
            { marked: true, text: "tariff" },
            { marked: false, text: " talk, not " },
            { marked: true, text: "tariffing" },
            { marked: false, text: "-free retariff." },
        ]);

        expect(splitByKeywords("plain", [])).toStrictEqual([{ marked: false, text: "plain" }]);
    });
});
