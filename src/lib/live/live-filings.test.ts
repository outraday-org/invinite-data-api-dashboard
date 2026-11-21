import { describe, expect, it } from "vitest";

import { LIVE_FILING, LIVE_FILING_S1 } from "@/lib/sec/filing-detail-fixtures";

import { addLiveFiling, commaList, hasLiveForm, isFilingOf, mergeLiveRows, toLiveFilingRow } from "./live-filings";

describe("live filings (pure)", () => {
    it("adds newest first, one per accession, capped", () => {
        const one = addLiveFiling([], LIVE_FILING, "2026-11-20T21:00:00Z");

        const two = addLiveFiling(one, LIVE_FILING_S1, "2026-11-20T21:01:00Z");

        expect(two.map(entry => entry.filing.accession_number)).toEqual([LIVE_FILING_S1.accession_number, LIVE_FILING.accession_number]);

        // The same accession again (a reconnect's duplicate) keeps the first arrival.
        expect(addLiveFiling(two, LIVE_FILING, "2026-11-20T21:02:00Z")).toEqual(two);

        expect(addLiveFiling(two, { ...LIVE_FILING, accession_number: "0000320193-26-000031" }, "2026-11-20T21:03:00Z", 2)).toHaveLength(2);
    });

    it("matches an instrument by the frame's primary ticker (a pre-IPO filing has none) and forms case-insensitively", () => {
        expect(isFilingOf(LIVE_FILING, "aapl")).toBe(true);

        expect(isFilingOf(LIVE_FILING_S1, "NEWC")).toBe(false);

        expect(hasLiveForm(LIVE_FILING, [])).toBe(true);

        expect(hasLiveForm(LIVE_FILING, ["10-K", "8-k"])).toBe(true);

        expect(hasLiveForm(LIVE_FILING, ["10-K"])).toBe(false);

        expect(commaList(" 8-K, ,S-1 ")).toEqual(["8-K", "S-1"]);

        expect(commaList(undefined)).toEqual([]);
    });

    it("a live filing becomes a list row marked live; a listed accession is shown once, as listed", () => {
        const row = toLiveFilingRow(LIVE_FILING);

        expect(row).toMatchObject({ accessionNumber: LIVE_FILING.accession_number, fiscalQuarter: 1, formType: "8-K", items: [], live: true, periodEnd: "2026-11-20" });

        const listed = { ...row, live: undefined };

        expect(mergeLiveRows([row], [listed])).toEqual([listed]);

        expect(mergeLiveRows([toLiveFilingRow(LIVE_FILING_S1)], [listed]).map(entry => entry.live)).toEqual([true, undefined]);
    });
});
