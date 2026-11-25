import { describe, expect, it } from "vitest";

import { beneficialOwnershipRequest, chainStatus, insiderSaleNoticesRequest, noticeChainMarkers, OWNERSHIP_FORMS_PAGE, percentOfClassText } from "./ownership-forms";

describe("beneficialOwnershipRequest (`/v1/beneficial-ownership`)", () => {
    it("sends nothing without a company or a valid filer CIK (the API needs one)", () => {
        expect(beneficialOwnershipRequest({})).toBeNull();

        expect(beneficialOwnershipRequest({ filer: "abc" })).toBeNull();

        expect(beneficialOwnershipRequest({ type: "activist" })).toBeNull();
    });

    it("company list and / or filer CIKs, the type, current=false only for the full chain, days in order", () => {
        expect(beneficialOwnershipRequest({ company: "AAPL,MSFT" })).toEqual({
            company: "AAPL,MSFT",
            current: undefined,
            filer: undefined,
            from: undefined,
            limit: OWNERSHIP_FORMS_PAGE,
            to: undefined,
            type: undefined,
        });

        expect(beneficialOwnershipRequest({ chain: "full", filer: "0000102909, 102909, x, 1067983", from: "2025-12-31", to: "2025-01-01", type: "passive" })).toEqual({
            company: undefined,
            current: false,
            filer: "102909,1067983",
            from: "2025-01-01",
            limit: OWNERSHIP_FORMS_PAGE,
            to: "2025-12-31",
            type: "passive",
        });
    });
});

describe("insiderSaleNoticesRequest (`/v1/insider-sale-notices`)", () => {
    it("needs a company or a seller CIK; sends the owner list as digits", () => {
        expect(insiderSaleNoticesRequest({ filer: "102909" })).toBeNull();

        expect(insiderSaleNoticesRequest({ owner: "1214156" })).toEqual({ company: undefined, from: undefined, limit: OWNERSHIP_FORMS_PAGE, owner: "1214156", to: undefined });

        expect(insiderSaleNoticesRequest({ company: "AAPL", type: "activist" })?.company).toBe("AAPL");
    });
});

describe("chain and percent helpers", () => {
    it("percent of class as filed (7.5 = 7.5 %)", () => {
        expect(percentOfClassText(7.5)).toBe("7.5%");

        expect(percentOfClassText(9.923)).toBe("9.92%");

        expect(percentOfClassText(null)).toBe("—");
    });

    it("a 13D / 13G filing: latest or superseded, and what it follows", () => {
        expect(chainStatus({ is_current: true, supersedes_accession: "0000102909-24-000877" })).toEqual({ label: "Latest", supersedes: "0000102909-24-000877" });

        expect(chainStatus({ is_current: false, supersedes_accession: null })).toEqual({ label: "Superseded", supersedes: null });
    });

    it("a Form 144 notice: replaces / replaced by markers", () => {
        expect(noticeChainMarkers({ replaced_by: null, replaces_accession: null })).toEqual([]);

        expect(noticeChainMarkers({ replaced_by: "B", replaces_accession: "A" }).map(marker => marker.text)).toEqual(["Replaces A", "Replaced by B"]);
    });
});
