import { describe, expect, it } from "vitest";

import { changeTypesParam, ignoredCikTokens, insiderCodeLegend, insiderCodeText, OFFERING_ID_PATTERN, parseChangeTypes, parseCikList } from "@/lib/sec/ownership";

describe("ownership helpers", () => {
    it("insider codes in words; an unknown code stays as filed; the legend keeps first appearance and drops repeats", () => {
        expect(insiderCodeText("P")).toBe("P · Open market or private purchase");

        expect(insiderCodeText("Q")).toBe("Q");

        expect(insiderCodeText(null)).toBeNull();

        expect(insiderCodeLegend(["S", "M", "S", null, "Q"])).toEqual([
            { code: "S", label: "Open market or private sale" },
            { code: "M", label: "Exercise or conversion of a derivative (exempt)" },
            { code: "Q", label: "As filed" },
        ]);
    });

    it("change types round-trip through the URL in the API's order; nothing valid = the server default", () => {
        expect(parseChangeTypes("sold_out,new,bogus,new")).toEqual(["new", "sold_out"]);

        expect(parseChangeTypes("bogus")).toBeUndefined();

        expect(parseChangeTypes(undefined)).toBeUndefined();

        expect(changeTypesParam(["unchanged", "added"])).toBe("added,unchanged");

        expect(changeTypesParam([])).toBeUndefined();
    });

    it("manager CIKs as typed: digits only, zeros dropped, de-duplicated, at most 50", () => {
        expect(parseCikList("0000102909, 2012383 abc,102909")).toEqual(["102909", "2012383"]);

        expect(parseCikList("abc")).toBeUndefined();

        expect(parseCikList(Array.from({ length: 60 }, (_, index) => String(index + 1)).join(","))).toHaveLength(50);

        expect(ignoredCikTokens("0000102909, 2012383 abc,102909, 12345678901")).toEqual(["abc", "12345678901"]);

        expect(ignoredCikTokens(" 102909 ,")).toEqual([]);

        expect(ignoredCikTokens(undefined)).toEqual([]);
    });

    it("an offering id is a Form D file number or an accession number", () => {
        expect(OFFERING_ID_PATTERN.test("021-599503")).toBe(true);

        expect(OFFERING_ID_PATTERN.test("0001991882-24-000002")).toBe(true);

        expect(OFFERING_ID_PATTERN.test("abc")).toBe(false);
    });
});
