import { describe, expect, it, vi } from "vitest";

import { Route as TickerFilingsRoute } from "@/routes/$ticker/filings/index";
import { Route as FilingRoute } from "@/routes/filings/$accession";
import { Route as MarketFilingsRoute } from "@/routes/filings/index";

vi.mock("@/lib/api/server-functions", () => ({}));

// A route's `validateSearch` is its zod schema.
const parse = (route: { options: { validateSearch?: unknown } }, search: Record<string, unknown>) =>
    (route.options.validateSearch as { parse: (input: Record<string, unknown>) => Record<string, unknown> }).parse(search);

const VERSION = "f735ba2e-582b-5682-a5c7-746c8cef1457";

describe("URL state of the filings views (O7 group 3)", () => {
    it("$ticker/filings: items, the filed range, live, search and a cited passage; a bare ?items=2.02 (read as a number) stays an item", () => {
        expect(parse(TickerFilingsRoute, { block: "b00136", from: "2025-01-01", items: "2.02,9.01", live: true, search: true, source: VERSION, to: "2026-11-20" }))
            .toEqual({ block: "b00136", from: "2025-01-01", items: "2.02,9.01", live: true, search: true, source: VERSION, to: "2026-11-20" });

        expect(parse(TickerFilingsRoute, { items: 2.1 })).toEqual({ items: "2.10" });

        expect(parse(TickerFilingsRoute, { block: "x", from: "yesterday", source: "not-a-uuid" })).toEqual({});
    });

    it("/filings/$accession: tab, the open version + panel + block, concepts, review depth / direction", () => {
        expect(parse(FilingRoute, { block: "b00085", depth: 3, direction: "up", noteTag: "X", outline: "legacy", panel: "places", tab: "review", tag: "Revenues", version: VERSION }))
            .toEqual({ block: "b00085", depth: 3, direction: "up", noteTag: "X", outline: "legacy", panel: "places", tab: "review", tag: "Revenues", version: VERSION });

        // 1 hop is the default (never written); 7 is past the API's maximum.
        expect(parse(FilingRoute, { depth: 7, panel: "read", tab: "documents" })).toEqual({});
    });

    it("/filings: paused, the live forms and the market-wide search's filters; a bare ?searchItem=7 stays a section id", () => {
        expect(parse(MarketFilingsRoute, { filedFrom: "2026-11-01", filedTo: "2026-11-20", form: "8-K,S-1", paused: true, searchForm: "10-K", searchItem: "1A,7" }))
            .toEqual({ filedFrom: "2026-11-01", filedTo: "2026-11-20", form: "8-K,S-1", paused: true, searchForm: "10-K", searchItem: "1A,7" });

        expect(parse(MarketFilingsRoute, { searchItem: 7 })).toEqual({ searchItem: "7" });
    });
});
