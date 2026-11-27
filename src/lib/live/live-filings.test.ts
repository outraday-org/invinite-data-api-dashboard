import { describe, expect, it } from "vitest";

import { LIVE_FILING, LIVE_FILING_S1 } from "@/lib/sec/filing-detail-fixtures";
import { V2_FILING_PRE_IPO, V2_FILINGS } from "@/lib/sec/v2-fixtures";

import { addLiveFiling, commaList, fromLiveFiling, fromRestFiling, hasLiveForm, isFilingOf, MAX_LIVE_FILINGS, mergeLatest, mergeLiveRows, padCik, toLiveFilingRow } from "./live-filings";

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

describe("the market-wide list (pure)", () => {
    const listedAapl = V2_FILINGS.data[0];

    it("a REST row: ticker = symbol, filer CIK / name from filer, else company, else the accession prefix", () => {
        expect(fromRestFiling(V2_FILING_PRE_IPO)).toEqual({
            accession: V2_FILING_PRE_IPO.accession,
            arrivedAt: null,
            cik: "0002166611",
            filedAt: "2026-11-25T21:40:02Z",
            filedDay: "2026-11-26",
            filerName: "Fidelity Chainlink Fund",
            form: "S-1",
            periodEnd: null,
            proposedTickers: [],
            source: "listed",
            ticker: null,
        });

        expect(fromRestFiling({ ...listedAapl, filer: null })).toMatchObject({ cik: "0000320193", filerName: null, ticker: "AAPL" });

        expect(fromRestFiling({ ...listedAapl, company: null, filer: null, symbol: null })).toMatchObject({ cik: "0001140361", ticker: null });
    });

    it("a live row: CIK padded to 10 digits, proposed tickers, the arrival instant", () => {
        expect(fromLiveFiling({ ...LIVE_FILING_S1, cik: "1999999" }, "2026-11-27T10:00:00Z")).toMatchObject({
            arrivedAt: "2026-11-27T10:00:00Z",
            cik: "0001999999",
            filedAt: null,
            proposedTickers: ["NEWC"],
            source: "live",
            ticker: null,
        });

        expect([padCik("320193"), padCik("0000320193"), padCik("AAPL"), padCik(null)]).toEqual(["0000320193", "0000320193", null, null]);
    });

    it("live rows not listed on top (newest arrival first), then the listed rows in API order; a listed accession once, with its arrival", () => {
        const live = [
            { filing: LIVE_FILING_S1, receivedAt: "2026-11-27T10:01:00Z" },
            { filing: { ...LIVE_FILING, accession_number: listedAapl.accession }, receivedAt: "2026-11-27T10:00:00Z" },
        ];

        const rows = mergeLatest(live, V2_FILINGS.data);

        expect(rows.map(row => [row.accession, row.source, row.arrivedAt])).toEqual([
            [LIVE_FILING_S1.accession_number, "live", "2026-11-27T10:01:00Z"],
            [listedAapl.accession, "listed", "2026-11-27T10:00:00Z"],
            [V2_FILINGS.data[1].accession, "listed", null],
        ]);

        // A REST refetch that now lists the live-only accession: shown once, as listed.
        const relisted = mergeLatest(live, [{ ...V2_FILING_PRE_IPO, accession: LIVE_FILING_S1.accession_number }, ...V2_FILINGS.data]);

        expect(relisted.map(row => row.source)).toEqual(["listed", "listed", "listed"]);

        expect(relisted[0].arrivedAt).toBe("2026-11-27T10:01:00Z");
    });

    it("live rows join page 1 only; the cap applies to live rows, listed rows are never cut", () => {
        const live = [{ filing: LIVE_FILING_S1, receivedAt: "2026-11-27T10:01:00Z" }];

        expect(mergeLatest(live, V2_FILINGS.data, 2).map(row => row.source)).toEqual(["listed", "listed"]);

        const many = Array.from({ length: MAX_LIVE_FILINGS + 50 }, (_, index) => ({ ...listedAapl, accession: `0000320193-26-${String(index).padStart(6, "0")}` }));

        expect(mergeLatest([], many)).toHaveLength(MAX_LIVE_FILINGS + 50);

        let held: ReturnType<typeof addLiveFiling> = [];

        for (let index = 0; index < MAX_LIVE_FILINGS + 5; index += 1) held = addLiveFiling(held, { ...LIVE_FILING, accession_number: `0000000001-26-${String(index).padStart(6, "0")}` }, "2026-11-27T10:00:00Z");

        expect(mergeLatest(held, [])).toHaveLength(MAX_LIVE_FILINGS);
    });
});
