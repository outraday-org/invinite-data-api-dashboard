// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2FilerResponse } from "@/lib/api/types";

import { cikOf, SecFilerMatches } from "@/components/sec/sec-filer-lookup";
import {
    exemptionLabel,
    offeringAmountText,
    SecFilerHeader,
    SecFilingsView,
    SecFundView,
    SecLifecycleView,
    SecPortfolioView,
    SecPrivateOfferingsView,
} from "@/components/sec/sec-filer-views";
import { ApiRequestError } from "@/lib/api/errors";
import { V2_FILER_HOLDINGS, V2_FILERS, V2_FILINGS, V2_OFFERINGS } from "@/lib/sec/v2-fixtures";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
    useNavigate: () => vi.fn(),
}));

vi.mock("@/lib/api/queries", () => ({ useV2Filers: vi.fn() }));

afterEach(cleanup);

describe("tickerless filer selection", () => {
    it("a typed CIK goes to its page (leading zeros dropped); a name is a search", () => {
        expect(cikOf("0000320193")).toBe("320193");

        expect(cikOf("Berkshire")).toBeNull();

        expect(cikOf("0")).toBeNull();
    });

    it("name matches link to /sec/$cik (zeros dropped) — a filer without a ticker included, labelled 'No ticker'", () => {
        render(<SecFilerMatches data={V2_FILERS} error={null} isLoading={false} />);

        expect(screen.getByRole("link", { name: "ADAMS STREET TRUEST - BERKSHIRE FUND V LP Zinc Series" })).toHaveAttribute("href", "/sec/1453746");

        expect(screen.getAllByText("No ticker")).toHaveLength(1);

        // A listed filer shows its verified listing, not every stated ticker.
        expect(screen.getByText("BRK-B")).toBeInTheDocument();

        expect(screen.queryByText("BRK-A")).toBeNull();

        expect(screen.getByText("Public")).toBeInTheDocument();
    });

    it("no match on a complete page is a genuine no-match", () => {
        render(<SecFilerMatches data={{ ...V2_FILERS, data: [] }} error={null} isLoading={false} />);

        expect(screen.getByText("No SEC filer matches this name.")).toBeInTheDocument();
    });

    it("the header of a tickerless filer says so and invents no ticker", () => {
        render(<SecFilerHeader cik="2063464" data={TICKERLESS_FILER} error={null} isLoading={false} />);

        expect(screen.getByText("Acme SPAC Corp")).toBeInTheDocument();

        expect(screen.getByText("No ticker")).toBeInTheDocument();

        expect(screen.getByText("Pre-IPO")).toBeInTheDocument();

        expect(screen.getByText("12-31")).toBeInTheDocument();
    });

    it("a listed filer shows its verified listing", () => {
        render(<SecFilerHeader cik="320193" data={{ ...TICKERLESS_FILER, listing: { exchange: "XNAS", ticker: "AAPL" }, phase: "public" }} error={null} isLoading={false} />);

        expect(screen.getByText("AAPL · XNAS")).toBeInTheDocument();

        expect(screen.queryByText("No ticker")).toBeNull();
    });

    it("a 404 not_covered problem is its state, with the API's detail", () => {
        const error = new ApiRequestError(404, { error: "not_covered", message: "CIK 0000000001 is not covered", requestId: "req_1" });

        render(<SecFilerHeader cik="1" data={null} error={error} isLoading={false} />);

        expect(screen.getByText("Not covered by the Invinite API")).toBeInTheDocument();

        expect(screen.getByText("CIK 0000000001 is not covered")).toBeInTheDocument();
    });

    it("a 403 excluded problem reads as outside the coverage", () => {
        const error = new ApiRequestError(403, { error: "excluded", message: "x" });

        render(<SecFilerHeader cik="1" data={null} error={error} isLoading={false} />);

        expect(screen.getByText("Outside the SEC store's coverage")).toBeInTheDocument();
    });
});

const TICKERLESS_FILER: V2FilerResponse = {
    cik: "0002063464",
    entity_type: "operating",
    fiscal_year_end: "12-31",
    listing: null,
    name: "Acme SPAC Corp",
    phase: "pre_ipo",
    sic: "6770",
    state_of_incorporation: "DE",
};

describe("SecLifecycleView", () => {
    it("a filer without lifecycle evidence says so; 503 unavailable is its state", () => {
        const { rerender } = render(<SecLifecycleView data={{ ...TICKERLESS_FILER, lifecycle: null, successors: [] }} error={null} isLoading={false} />);

        expect(screen.getByText("No lifecycle evidence for this filer.")).toBeInTheDocument();

        expect(screen.queryByText("Registration tracks")).toBeNull();

        rerender(<SecLifecycleView data={null} error={new ApiRequestError(503, { error: "unavailable", message: "The SEC store is unavailable" })} isLoading={false} />);

        expect(screen.getByText("Temporarily unavailable — try again later")).toBeInTheDocument();
    });

    it("phase, tracks with their review status, pending actions, proposed symbols, successors, former names", () => {
        const data: V2FilerResponse = {
            ...TICKERLESS_FILER,
            former_names: [{ name: "Acme Holdings Inc", until: "2024-05-01" }],
            lifecycle: {
                first_public_seen_at: null,
                ipo_pending: [],
                kind: "spac",
                last_observed_at: "2026-11-08T10:00:00Z",
                pending_actions: [{ action: "await_effectiveness", track_id: "t1" }],
                phase: "registration_filed",
                registration_tracks: [{ form: "S-1", review_status: "verified", stage: "registered", track_key: "333-123456" }, { track_key: "333-999" }],
                warnings: ["listing_unconfirmed"],
            },
            proposed_symbols: [{ exchange: "NASDAQ", ipo_calendar_match: true, security_class: "units", source: "regex", symbol: "ACMEU" }],
            successors: [{ cik: "0000000099", kind: "legal_successor", name: "Acme Inc" }],
        };

        render(<SecLifecycleView data={data} error={null} isLoading={false} />);

        expect(screen.getByText("registration_filed")).toBeInTheDocument();

        expect(screen.getByText("333-123456")).toBeInTheDocument();

        expect(screen.getByText("Review status: verified")).toBeInTheDocument();

        expect(screen.getAllByText("Review status: not stated")).toHaveLength(1);

        expect(screen.getByText("await_effectiveness")).toBeInTheDocument();

        expect(screen.getByText("ACMEU · NASDAQ · units · on the IPO calendar")).toBeInTheDocument();

        expect(screen.getByText("Acme Inc · CIK 0000000099 · legal successor")).toBeInTheDocument();

        expect(screen.getByText("Acme Holdings Inc (until 2024-05-01)")).toBeInTheDocument();

        expect(screen.getByText("listing unconfirmed")).toBeInTheDocument();
    });
});

const FUND_SERIES = {
    advisers: [],
    authorized_participant_count: 0,
    creation_cash_pct_avg: null,
    creation_unit_shares: null,
    exchange: null,
    expense_ratio_as_of: null,
    expense_ratio_class_id: null,
    expense_ratio_gross: null,
    expense_ratio_net: null,
    fund_key: "S000000000",
    is_etf: null,
    is_fund_of_funds: null,
    is_index: null,
    is_money_market: null,
    is_target_date: null,
    latest_report_date: null,
    ncen_accession_number: null,
    ncen_report_period: null,
    net_assets_as_of: null,
    net_assets_scope: null,
    net_assets_usd: null,
    nport_accession_number: null,
    redeemed_creation_unit_shares: null,
    registrant_cik: "0000036405",
    returns: [],
    rr_accession_number: null,
    rr_report_period: null,
    series_id: null,
    series_name: null,
    share_classes: [],
} satisfies NonNullable<V2FilerResponse["fund"]>["series"][number];

describe("SecFundView (`expand=fund`)", () => {
    it("one row per series: name + ETF flag, exchange, class tickers, expense ratio, net assets with scope and date, returns", () => {
        const data: V2FilerResponse = {
            ...TICKERLESS_FILER,
            fund: {
                investment_company_type: "N-1A",
                series: [
                    {
                        ...FUND_SERIES,
                        exchange: "XNAS",
                        expense_ratio_class_id: "C000092055",
                        expense_ratio_net: 0.0003,
                        fund_key: "S000002277",
                        is_etf: true,
                        net_assets_as_of: "2026-09-30",
                        net_assets_scope: "series",
                        net_assets_usd: 1_543_210_987_654.32,
                        returns: [
                            { as_of: "2025-12-31", class_id: "C000007773", five_year: 0.1, one_year: 0.2, since_inception: null, ten_year: 0.12 },
                            { as_of: "2025-12-31", class_id: "C000092055", five_year: 0.1452, one_year: 0.2499, since_inception: null, ten_year: 0.1308 },
                        ],
                        series_id: "S000002277",
                        series_name: "Vanguard 500 Index Fund",
                        share_classes: [
                            { class_id: "C000007773", class_name: "Admiral Shares", ticker: "VFIAX" },
                            { class_id: "C000092055", class_name: "ETF Shares", ticker: "VOO" },
                            { class_id: "C000007774", class_name: "Institutional", ticker: null },
                        ],
                    },
                    { ...FUND_SERIES, fund_key: "cik:884394", net_assets_scope: "fund", net_assets_usd: 712_345_678_901.23, series_name: null },
                ],
                series_count: 2,
            },
        };

        render(<SecFundView data={data} />);

        expect(screen.getByText("Vanguard 500 Index Fund")).toHaveAttribute("title", "S000002277");

        expect(screen.getByText("ETF")).toBeInTheDocument();

        expect(screen.getByText("XNAS")).toBeInTheDocument();

        expect(screen.getByText("VFIAX, VOO")).toBeInTheDocument();

        expect(screen.getByText("0.03%")).toBeInTheDocument();

        expect(screen.getByText("$1.54T · series total, all classes · as of Sep 30, 2026")).toBeInTheDocument();

        // The expense ratio's class (VOO) supplies the returns, not the first class listed.
        expect(screen.getByText("24.99%")).toBeInTheDocument();

        expect(screen.getByText("13.08%")).toBeInTheDocument();

        // A unit trust without a series name reads its fund key; no fees = a dash.
        expect(screen.getByText("cik:884394")).toBeInTheDocument();

        expect(screen.getByText("$712.35B · fund")).toBeInTheDocument();

        expect(screen.getByText("N-1A")).toBeInTheDocument();
    });

    it("renders nothing for a filer without fund series (fund: null) or without the expansion", () => {
        const { container, rerender } = render(<SecFundView data={{ ...TICKERLESS_FILER, fund: null }} />);

        expect(container).toBeEmptyDOMElement();

        rerender(<SecFundView data={TICKERLESS_FILER} />);

        expect(container).toBeEmptyDOMElement();
    });
});

describe("SecFilingsView", () => {
    it("lists the cursor page, filters by the form facet and opens a filing's documents", () => {
        const onOpen = vi.fn();

        render(
            <SecFilingsView
                error={null}
                form={null}
                hasNextPage
                isFetchingNextPage={false}
                isLoading={false}
                onFormChange={() => undefined}
                onMore={() => undefined}
                onOpen={onOpen}
                pages={[V2_FILINGS]}
            />,
        );

        expect(screen.getByText("0000320193-26-000026")).toBeInTheDocument();

        // Filed / period as days, never the raw ISO string (UI walk F004).
        expect(screen.getByText("Nov 3, 2026")).toBeInTheDocument();

        expect(screen.getByText("Sep 26, 2026")).toBeInTheDocument();

        expect(screen.queryByText("2026-11-03")).toBeNull();

        expect(screen.getByRole("button", { name: "More filings" })).toBeInTheDocument();

        fireEvent.click(screen.getAllByRole("button", { name: /Documents/ })[1]);

        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ accession: "0000320193-26-000026", kind: "filing" }));
    });

    it("an excluded filer (403) is its state, not 'No filings'", () => {
        const error = new ApiRequestError(403, { error: "excluded", message: "x", requestId: "req_1" });

        render(
            <SecFilingsView
                error={error}
                form={null}
                hasNextPage={false}
                isFetchingNextPage={false}
                isLoading={false}
                onFormChange={() => undefined}
                onMore={() => undefined}
                onOpen={() => undefined}
                pages={[]}
            />,
        );

        expect(screen.getByText("Outside the SEC store's coverage")).toBeInTheDocument();

        expect(screen.queryByText("No filings.")).toBeNull();
    });
});

describe("SecPortfolioView (`/v1/filers/{cik}/holdings`)", () => {
    const view = (props: Partial<Parameters<typeof SecPortfolioView>[0]>) => (
        <SecPortfolioView error={null} hasNextPage={false} isFetchingNextPage={false} isLoading={false} onMore={() => undefined} pages={[]} {...props} />
    );

    it("lists the positions with the page's provenance, the quarter's 13F filing once, discretion and voting; 'Load more' while a cursor remains", () => {
        const onMore = vi.fn();

        render(view({ exportScope: "cik-102909", hasNextPage: true, onMore, pages: [V2_FILER_HOLDINGS] }));

        // The held security opens its instrument page.
        expect(screen.getByRole("link", { name: "AAPL" })).toHaveAttribute("href", "/AAPL");

        expect(screen.getByText("037833100")).toBeInTheDocument();

        expect(screen.getByText("$412,000,000,000")).toBeInTheDocument();

        expect(screen.getByTestId("v2-meta-line")).toHaveTextContent("through Sep 30, 2026");

        expect(screen.getByTestId("portfolio-filing")).toHaveTextContent("13F filed Nov 13, 2026");

        expect(screen.getByRole("link", { name: "EDGAR" })).toHaveAttribute("href", V2_FILER_HOLDINGS.data[0].filing_url);

        expect(screen.getByText("Sole 1,390,000,000 · Shared 0 · None 0")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /load more/i }));

        expect(onMore).toHaveBeenCalledOnce();
    });

    it("a pending quarter is its notice, never 'no positions'", () => {
        render(view({ pages: [{ ...V2_FILER_HOLDINGS, data: [], meta: { coverage: { retry_after_s: 60, state: "pending" } } }] }));

        expect(screen.getByText("Being prepared — asked again in 30 s")).toBeInTheDocument();

        expect(screen.queryByText(/reported no positions/)).toBeNull();
    });
});

describe("Private offerings (`/v1/filers/{cik}?expand=private_offerings` + `/v1/offerings?company=`)", () => {
    const summary = {
        count: 2,
        first_filed: "2024-06-03",
        latest_exemptions: ["06c", "3C.7"],
        latest_filed: "2026-03-12",
        latest_offering_id: "021-528681",
        total_sold: 87_500_000,
    };

    const state = { error: null, hasNextPage: true, isFetchingNextPage: false, isLoading: false, onMore: () => undefined };

    it("the summary facts, one row per offering (file number or accession, amendments, labelled exemptions, USD) and More", () => {
        render(<SecPrivateOfferingsView {...state} pages={[V2_OFFERINGS]} summary={summary} />);

        expect(screen.getByText("latest exemptions:").nextSibling).toHaveTextContent("Rule 506(c), ICA 3(c)(7)");

        expect(screen.getByText("total sold:").nextSibling).toHaveTextContent("$87.50 M");

        // The offering opens its detail page.
        expect(screen.getByRole("link", { name: "021-528681" })).toHaveAttribute("href", "/offerings/021-528681");

        const amended = screen.getByText("021-528681").closest("tr")!;

        expect(amended).toHaveTextContent("1 amendment");

        expect(amended).toHaveTextContent("$150.00 M");

        expect(amended).toHaveTextContent("42");

        const indefinite = screen.getByText("0001991882-24-000002").closest("tr")!;

        expect(indefinite).toHaveTextContent("Indefinite");

        expect(indefinite).toHaveTextContent("Rule 506(b)");

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });

    it("null summary (no Form D, or Form D not served) renders nothing; a zero count shows the summary only", () => {
        const { container } = render(<SecPrivateOfferingsView {...state} pages={[]} summary={null} />);

        expect(container).toBeEmptyDOMElement();

        render(<SecPrivateOfferingsView {...state} hasNextPage={false} pages={[]} summary={{ ...summary, count: 0, total_sold: null }} />);

        expect(screen.getByText("offerings:").nextSibling).toHaveTextContent("0");

        expect(screen.queryByRole("table")).toBeNull();
    });

    it("labels: known codes, ICA 3(c)(n), unknown codes as filed; offering size", () => {
        expect(exemptionLabel("04")).toBe("Rule 504");

        expect(exemptionLabel("3C.1")).toBe("ICA 3(c)(1)");

        expect(exemptionLabel("06")).toBe("06");

        expect(offeringAmountText({ indefinite_amount: false, total_offering_amount: null })).toBe("—");
    });
});
