import { describe, expect, it } from "vitest";

import { isCompanyToken, joinCompanyList, MAX_COMPANIES, parseCompanyList } from "./company-list";

describe("company lists", () => {
    it("parses a comma list: trimmed, upper case, no repeats, at most 50", () => {
        expect(parseCompanyList(" aapl, MSFT,,aapl ,320193")).toEqual(["AAPL", "MSFT", "320193"]);

        expect(parseCompanyList(undefined)).toEqual([]);

        expect(parseCompanyList(Array.from({ length: 60 }, (_, index) => `T${index}`).join(","))).toHaveLength(MAX_COMPANIES);
    });

    it("joins; none = undefined", () => {
        expect(joinCompanyList(["AAPL", "MSFT"])).toBe("AAPL,MSFT");

        expect(joinCompanyList([])).toBeUndefined();
    });

    it("a typed ticker or CIK stands by itself; a name does not", () => {
        expect(isCompanyToken("brk.b")).toBe(true);

        expect(isCompanyToken("320193")).toBe(true);

        expect(isCompanyToken("apple inc")).toBe(false);
    });
});
