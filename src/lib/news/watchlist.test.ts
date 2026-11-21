import { describe, expect, it } from "vitest";

import { addTickers, parseTickers, readWatchlist, WATCHLIST_MAX } from "./watchlist";

describe("parseTickers", () => {
    it("reads a typed line as upper-case tickers, keeps class suffixes, drops junk and repeats", () => {
        expect(parseTickers("aapl, msft nvda;brk.b BRK-A aapl")).toEqual(["AAPL", "MSFT", "NVDA", "BRK.B", "BRK-A"]);

        expect(parseTickers("$$$ toolongticker -")).toEqual([]);
    });
});

describe("addTickers", () => {
    it("appends without repeats and stops at the maximum", () => {
        expect(addTickers(["AAPL"], ["MSFT", "AAPL"])).toEqual(["AAPL", "MSFT"]);

        const many = Array.from({ length: 30 }, (_, index) => `T${index}`);

        expect(addTickers([], many)).toHaveLength(WATCHLIST_MAX);
    });
});

describe("readWatchlist", () => {
    it("reads a stored array back and treats anything else as empty", () => {
        expect(readWatchlist(JSON.stringify(["AAPL", 3, "msft", "NVDA"]))).toEqual(["AAPL", "NVDA"]);

        expect(readWatchlist("{")).toEqual([]);

        expect(readWatchlist(JSON.stringify({ a: 1 }))).toEqual([]);

        expect(readWatchlist(null)).toEqual([]);
    });
});
