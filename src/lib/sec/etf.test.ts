import { describe, expect, it } from "vitest";

import { etfBasisNote, etfPickerDays, etfReasonText, etfSourceText, etfWeightsByDimension } from "@/lib/sec/etf";
import { V2_ETF_HOLDINGS, V2_ETF_WEIGHTS } from "@/lib/sec/v2-fixtures";

describe("ETF composition helpers (release 5.10)", () => {
    it("labels a composition by source and as-of date, never 'current'", () => {
        expect(etfSourceText("issuer_daily", "2026-11-13")).toBe("Issuer file · as of 2026-11-13");

        expect(etfSourceText("issuer_monthly", "2026-10-31")).toBe("Issuer file (monthly) · as of 2026-10-31");

        expect(etfSourceText("nport", "2026-09-30")).toBe("SEC N-PORT filing · as of 2026-09-30");

        expect(etfSourceText(null, "2026-09-30")).toBeNull();
    });

    it("the picker offers the served days only (ready issuer files, N-PORT reports), newest first", () => {
        expect(etfPickerDays(V2_ETF_HOLDINGS.meta.composition?.stored_dates)).toEqual([
            { label: "2026-11-13 · Issuer file", value: "2026-11-13" },
            { label: "2026-11-11 · Issuer file", value: "2026-11-11" },
            { label: "2026-09-30 · SEC N-PORT filing", value: "2026-09-30" },
        ]);

        expect(etfPickerDays(null)).toEqual([]);
    });

    it("groups the weights per dimension, largest first, and names their basis", () => {
        const groups = etfWeightsByDimension(V2_ETF_WEIGHTS.data);

        expect(groups.map(group => group.dimension)).toEqual(["sector", "country"]);

        expect(groups[0]?.weights.map(weight => weight.bucket)).toEqual(["Information Technology", "Financials"]);

        expect(etfBasisNote(groups[1]?.weights ?? [])).toBe("partly derived, not classified");

        expect(etfReasonText("single_asset_trust")).toBe("This fund holds one asset; there is no holdings list.");

        expect(etfReasonText(null)).toBeNull();
    });
});
