// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import type { RecentSubject } from "./ticker-store";

import { storedRecents, useTickerStore } from "./ticker-store";

const AAPL: RecentSubject = { badge: "Stock", kind: "instrument", label: "AAPL", name: "Apple Inc.", ref: "AAPL" };

const BERKSHIRE: RecentSubject = { badge: "Institution", kind: "filer", label: "Berkshire Hathaway", name: "CIK 1067983", ref: "1067983" };

const SPY: RecentSubject = { badge: "ETF", kind: "instrument", label: "SPY", name: "SPDR S&P 500 ETF Trust", ref: "SPY" };

/** A spot-coin recent as an earlier build stored it (the kind no longer exists). */
const STORED_COIN = { badge: "Spot coin", kind: "coin", label: "BTC", name: "Bitcoin", ref: "bitcoin" };

describe("storedRecents (the rehydration filter of invinite-recents)", () => {
    it("drops a stored coin entry and keeps the other entries in their order", () => {
        expect(storedRecents({ recents: [AAPL, STORED_COIN, BERKSHIRE, SPY] })).toEqual([AAPL, BERKSHIRE, SPY]);
    });

    it("drops entries without a known kind", () => {
        expect(storedRecents({ recents: [null, "AAPL", { ref: "x" }, AAPL] })).toEqual([AAPL]);
    });

    it("is null when nothing usable is stored", () => {
        expect(storedRecents(undefined)).toBeNull();

        expect(storedRecents({})).toBeNull();
    });
});

describe("useTickerStore hydration", () => {
    beforeEach(() => {
        // A store write is persisted too, so the storage is cleared after it.
        useTickerStore.setState({ recents: [] });

        window.localStorage.clear();
    });

    it("drops a stored coin recent from localStorage and keeps the rest in order", async () => {
        window.localStorage.setItem("invinite-recents", JSON.stringify({ state: { recents: [STORED_COIN, AAPL, BERKSHIRE] }, version: 0 }));

        await useTickerStore.persist.rehydrate();

        expect(useTickerStore.getState().recents).toEqual([AAPL, BERKSHIRE]);
    });

    it("keeps the current recents when nothing is stored", async () => {
        useTickerStore.setState({ recents: [SPY] });

        window.localStorage.clear();

        await useTickerStore.persist.rehydrate();

        expect(useTickerStore.getState().recents).toEqual([SPY]);
    });
});
