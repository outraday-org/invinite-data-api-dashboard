import { describe, expect, it } from "vitest";

import { coverageEntries, coverageFamilyLabel, v2Expand, v2Query } from "./v2";

describe("v2Query", () => {
    it("drops unset parameters (an unknown or empty one would be a 400 unknown_parameter)", () => {
        expect(v2Query({ "company": "AAPL", "cursor": undefined, "ex_date.gte": "2025-01-01", "ex_date.lte": undefined, "limit": 40, "sort": "-ex_date" })).toEqual({
            "company": "AAPL",
            "ex_date.gte": "2025-01-01",
            "limit": 40,
            "sort": "-ex_date",
        });

        expect(Object.keys(v2Query({ cursor: undefined, expand: undefined }))).toEqual([]);
    });
});

describe("v2Expand", () => {
    it("one sorted, de-duplicated spelling; nothing when empty", () => {
        expect(v2Expand(["successors", "lifecycle", "lifecycle"])).toBe("lifecycle,successors");

        expect(v2Expand([])).toBeUndefined();

        expect(v2Expand(undefined)).toBeUndefined();
    });
});

describe("company coverage", () => {
    it("names each family with its through day, in the API's order", () => {
        const entries = coverageEntries({
            families: [
                { family: "financials", through: "2026-09-26" },
                { family: "insider_trades", through: null },
                { family: "new_family", through: "2026-11-01" },
            ],
        });

        expect(entries.map(entry => entry.text)).toEqual([
            "financials through 2026-09-26",
            "insider trades",
            "new family through 2026-11-01",
        ]);
    });

    it("no coverage = no entries; holdings has its own words", () => {
        expect(coverageEntries(null)).toEqual([]);

        expect(coverageEntries(undefined)).toEqual([]);

        expect(coverageFamilyLabel("holdings")).toBe("institutional holdings");
    });
});
