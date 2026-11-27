import { describe, expect, it } from "vitest";

import { normalizeWatchlist, readWatchlist, WATCHLIST_MAX } from "./watchlist";

describe("normalizeWatchlist", () => {
    it("keeps tickers and CIKs upper case, drops junk and repeats, stops at the maximum", () => {
        expect(normalizeWatchlist(["aapl", " MSFT ", "brk.b", "320193", "$$$", "AAPL"])).toEqual(["AAPL", "MSFT", "BRK.B", "320193"]);

        const many = Array.from({ length: 30 }, (_, index) => `T${index}`);

        expect(normalizeWatchlist(many)).toHaveLength(WATCHLIST_MAX);
    });
});

describe("readWatchlist", () => {
    it("reads a stored array back and treats anything else as empty", () => {
        expect(readWatchlist(JSON.stringify(["AAPL", 3, "msft", "NVDA"]))).toEqual(["AAPL", "MSFT", "NVDA"]);

        expect(readWatchlist("{")).toEqual([]);

        expect(readWatchlist(JSON.stringify({ a: 1 }))).toEqual([]);

        expect(readWatchlist(null)).toEqual([]);
    });
});
