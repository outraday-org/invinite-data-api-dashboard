import { describe, expect, it, vi } from "vitest";

import { financialsSearchSchema } from "@/components/financials-pages/financials-search";
import { Route as CallRoute } from "@/routes/$ticker/earnings-calls/$eventId/index";
import { callLinkAt, copyCallLinkAt } from "@/routes/$ticker/earnings-calls/-components/call-search";
import { Route as CallsRoute } from "@/routes/$ticker/earnings-calls/index";
import { Route as FilingsRoute } from "@/routes/$ticker/filings/index";
import { Route as HoldersRoute } from "@/routes/$ticker/holders/index";
import { Route as HoldingsRoute } from "@/routes/$ticker/holdings/index";
import { Route as InsiderRoute } from "@/routes/$ticker/insider-trades/index";
import { Route as OfferingsRoute } from "@/routes/offerings/index";
import { Route as FilerRoute } from "@/routes/sec/$cik";

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("sonner", () => ({ toast: toasts }));

vi.mock("@/lib/api/server-functions", () => ({}));

// A route's `validateSearch` is its zod schema.
const parse = (route: { options: { validateSearch?: unknown } }, search: Record<string, unknown>) =>
    (route.options.validateSearch as { parse: (input: Record<string, unknown>) => Record<string, unknown> }).parse(search);

describe("URL state (validateSearch): a reload restores what the URL says, an invalid value falls back", () => {
    it("offerings: an industry under the API's 2 characters reads as none (never a 400 / a validation dump)", () => {
        expect(parse(OfferingsRoute, { industry: "a" })).toEqual({});

        expect(parse(OfferingsRoute, { industry: " Other Technology " })).toEqual({ industry: "Other Technology" });
    });

    it("filings: form, sort, the open filing and the documents panel", () => {
        expect(parse(FilingsRoute, { docs: "0000320193-24-000123", filing: "0000320193-24-000081", form: "10-K", sort: "asc" }))
            .toEqual({ docs: "0000320193-24-000123", filing: "0000320193-24-000081", form: "10-K", sort: "asc" });

        expect(parse(FilingsRoute, { filing: "not-an-accession", sort: "sideways" })).toEqual({});
    });

    it("insider trades: side and the filed day range", () => {
        expect(parse(InsiderRoute, { from: "2026-01-01", side: "buy", to: "2026-06-30" })).toEqual({ from: "2026-01-01", side: "buy", to: "2026-06-30" });

        expect(parse(InsiderRoute, { from: "yesterday", side: "short" })).toEqual({});
    });

    it("holders: tab and quarter; holdings: the as-of day", () => {
        expect(parse(HoldersRoute, { period: "2026-06-30", tab: "nport" })).toEqual({ period: "2026-06-30", tab: "nport" });

        expect(parse(HoldersRoute, { tab: "everything" })).toEqual({});

        expect(parse(HoldingsRoute, { day: "2026-11-20" })).toEqual({ day: "2026-11-20" });
    });

    it("calls list: tab and search source; SEC filer: form, 13F period, documents panel", () => {
        expect(parse(CallsRoute, { fiscalYear: "2026", search: "documents", tab: "past" })).toEqual({ fiscalYear: 2026, search: "documents", tab: "past" });

        expect(parse(FilerRoute, { docs: "0001067983-25-000001", form: "13F-HR", period: "2026-09-30" }))
            .toEqual({ docs: "0001067983-25-000001", form: "13F-HR", period: "2026-09-30" });
    });

    it("call page (O6-final): tab, transcript format and version, the moment ?t= in seconds", () => {
        expect(parse(CallRoute, { format: "cleaned", t: "754", tab: "qa", version: "2" })).toEqual({ format: "cleaned", t: 754, tab: "qa", version: 2 });

        expect(parse(CallRoute, { format: "pdf", t: -5, tab: "audio", version: 0 })).toEqual({});

        expect(parse(CallRoute, { t: 1.5 })).toEqual({});
    });

    it("call page: the copied link keeps the other params and replaces t", () => {
        expect(callLinkAt("https://dash.test/NVDA/earnings-calls/e1?format=text&t=10", 754.9))
            .toBe("https://dash.test/NVDA/earnings-calls/e1?format=text&t=754");
    });

    it("call page: Copy link at current time writes ?t= into the address bar, then copies the link", async () => {
        const writeText = vi.fn(() => Promise.resolve());

        vi.stubGlobal("window", { location: { href: "https://dash.test/NVDA/earnings-calls/e1?format=text" } });

        vi.stubGlobal("navigator", { clipboard: { writeText } });

        const onSearchChange = vi.fn();

        await copyCallLinkAt(754.6, onSearchChange);

        expect(onSearchChange).toHaveBeenCalledWith({ t: 754 });

        expect(writeText).toHaveBeenCalledWith("https://dash.test/NVDA/earnings-calls/e1?format=text&t=754");

        expect(toasts.success).toHaveBeenCalledWith("Link at 12:34 copied");

        vi.unstubAllGlobals();
    });

    it("call page: without clipboard access the link still reaches the address bar and the click does not throw", async () => {
        vi.stubGlobal("window", { location: { href: "https://dash.test/NVDA/earnings-calls/e1" } });

        vi.stubGlobal("navigator", {});

        const onSearchChange = vi.fn();

        await expect(copyCallLinkAt(95, onSearchChange)).resolves.toBeUndefined();

        expect(onSearchChange).toHaveBeenCalledWith({ t: 95 });

        expect(toasts.error).toHaveBeenCalled();

        vi.unstubAllGlobals();
    });

    it("financials: every tab's filter and the charted row", () => {
        const search = {
            basis: "yoy",
            category: "liquidity",
            chart: "revenue",
            horizon: "5",
            layout: "detailed",
            period: "annual",
            reportedOnly: true,
            segment: "seg_revenue_product",
            sign: "cash_flow_direction",
            statement: "cash-flow",
            view: "as-reported",
        };

        expect(financialsSearchSchema.parse(search)).toEqual(search);

        expect(financialsSearchSchema.parse({ layout: "tree", period: "weekly", statement: "cash-flow-statement" })).toEqual({});
    });
});
