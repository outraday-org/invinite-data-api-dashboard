// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeadingLevelProvider } from "@/components/ui/page-header";
import { useFund, useFundPositionsInfinite, useInstrument, useV2Company } from "@/lib/api/queries";
import { ACA_INSTRUMENT, GLD_INSTRUMENT, VOO_FUND, VXX_INSTRUMENT } from "@/lib/instruments-fixtures";
import { V2_FUND_POSITIONS } from "@/lib/sec/v2-fixtures";
import { CompositionMeta, FundProfileView, netAssetsParts } from "@/routes/$ticker/-overview/fund-overview";
import { Route } from "@/routes/$ticker/index";

const route = vi.hoisted(() => ({ ticker: "VOO" }));

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options, useParams: () => ({ ticker: route.ticker }) }),
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

vi.mock("@/lib/api/queries", () => ({
    useFund: vi.fn(),
    useFundPositionsInfinite: vi.fn(() => ({ data: null, error: null })),
    useInstrument: vi.fn(),
    // The overview's alert entry points (alerts task 4): no key in these tests = none shown.
    useKeyState: () => ({ me: null }),
    useSymbolAlertCount: () => ({ data: null }),
    useV2Company: vi.fn(() => ({ data: null, error: null, isLoading: true })),
}));

afterEach(cleanup);

const TickerOverview = Route.options.component as React.ComponentType;

describe("fund overview (`/v1/funds/{fund}`)", () => {
    it("VOO: net assets with date and scope 'series total', no market cap; the registrant links its filer page; classes", () => {
        render(<FundProfileView composition={null} fund={VOO_FUND} />);

        expect(screen.getByTestId("fund-net-assets")).toHaveTextContent("$1.7T");

        expect(screen.getByText("Net assets").parentElement).toHaveTextContent("as of Jun 30, 2026 · series total, all share classes");

        expect(screen.queryByText("Market cap")).toBeNull();

        expect(screen.getByRole("link", { name: "Vanguard Index Funds" })).toHaveAttribute("href", "/sec/36405");

        expect(screen.getByText("Expense ratio (net)").parentElement).toHaveTextContent("Expense ratio (net)0.03%as of Apr 29, 2026");

        expect(screen.getByRole("link", { name: "VOO" })).toHaveAttribute("href", "/VOO");

        expect(screen.getByText("VFIAX")).toBeInTheDocument();

        expect(netAssetsParts({ ...VOO_FUND, net_assets_usd: null })).toBeNull();

        // The same building blocks as a stock: a stat grid, sections, no card.
        expect(document.querySelectorAll("[data-slot=card]")).toHaveLength(0);

        expect(document.querySelector("[data-slot=stat-grid]")).not.toBeNull();
    });

    it("advisers with role, CRD, LEI and affiliation; the website (https only); the data families of expand=coverage", () => {
        render(
            <FundProfileView
                composition={null}
                fund={{
                    ...VOO_FUND,
                    advisers: [
                        { crd: "000105958", is_affiliated: false, lei: "549300LNYY7KJ8XVHU53", name: "Example Sub-Advisor LLC", role: "Subadvisor" },
                        ...VOO_FUND.advisers,
                    ],
                    coverage: { families: [{ family: "dividends", through: "2026-09-18" }] },
                    homepage_url: "https://investor.vanguard.com/",
                }}
            />,
        );

        const advisers = screen.getByTestId("fund-advisers");

        // Advisers before sub-advisers.
        expect(advisers.firstElementChild).toHaveTextContent("The Vanguard Group, Inc.AdvisorAffiliated");

        expect(advisers.lastElementChild).toHaveTextContent("Example Sub-Advisor LLCSubadvisorUnaffiliated");

        expect(screen.getByText("000105958")).toBeInTheDocument();

        expect(screen.getByText("549300LNYY7KJ8XVHU53")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: "investor.vanguard.com" })).toHaveAttribute("href", "https://investor.vanguard.com/");

        expect(screen.getByText("The data families that hold rows for this fund")).toBeInTheDocument();

        expect(screen.getByText("dividends").closest("a")).toHaveAttribute("href", "/VOO/dividends");

        cleanup();

        render(<FundProfileView composition={null} fund={{ ...VOO_FUND, homepage_url: "javascript:alert(1)" }} />);

        expect(screen.queryByText("Website")).toBeNull();
    });

    it("the overview asks the fund profile with expand=coverage", () => {
        route.ticker = "VOO";

        vi.mocked(useInstrument).mockReturnValue({ data: { ...GLD_INSTRUMENT, structure: "registered_fund", symbol: "VOO" }, isLoading: false } as never);

        vi.mocked(useFund).mockReturnValue({ data: VOO_FUND, error: null, isLoading: false } as never);

        render(<TickerOverview />);

        expect(useFund).toHaveBeenCalledWith("VOO", ["coverage"]);
    });

    it("the composition line names its source and as-of and links the Holdings page", () => {
        render(<CompositionMeta error={null} page={V2_FUND_POSITIONS} ticker="SPY" />);

        expect(screen.getByTestId("fund-source-badge")).toHaveTextContent("Issuer file · as of Nov 13, 2026");

        expect(screen.getByRole("link", { name: "Holdings and weights" })).toHaveAttribute("href", "/SPY/holdings");
    });

    it("an exchange-traded trust says it files no holdings report and asks for no composition", () => {
        route.ticker = "GLD";

        vi.mocked(useInstrument).mockReturnValue({ data: GLD_INSTRUMENT, isLoading: false } as never);

        vi.mocked(useFund).mockReturnValue({ data: { ...VOO_FUND, name: "SPDR Gold Shares", structure: "exchange_traded_trust", symbol: "GLD" }, error: null, isLoading: false } as never);

        render(<TickerOverview />);

        expect(screen.getByTestId("fund-no-holdings")).toHaveTextContent("GLD is an ETF structured as an exchange-traded trust: it files no holdings report");

        expect(useFundPositionsInfinite).toHaveBeenLastCalledWith({ fund: "", limit: 1 });

        expect(screen.getByText("Exchange-traded trust")).toBeInTheDocument();

        // No "N-PORT net assets" promised for a trust (UI walk F091).
        expect(screen.getByText("Shares and short interest; a trust files no N-PORT report")).toBeInTheDocument();

        expect(screen.queryByText("N-PORT net assets, prospectus expense ratio")).toBeNull();
    });

    it("an ETN shows the instrument only", () => {
        route.ticker = "VXX";

        vi.mocked(useInstrument).mockReturnValue({ data: VXX_INSTRUMENT, isLoading: false } as never);

        // Under the ticker layout's provider (its header's h1 is the symbol), as on the page.
        render(<HeadingLevelProvider value={2}><TickerOverview /></HeadingLevelProvider>);

        // The page title every page renders (F032).
        expect(screen.getByRole("heading", { level: 2, name: "Overview" })).toBeInTheDocument();

        expect(screen.getByText(/An exchange-traded note/)).toBeInTheDocument();

        expect(screen.getByText("ETN")).toBeInTheDocument();

        expect(useFund).not.toHaveBeenCalledWith("VXX");
    });

    it("a delisted stock says it is delisted (not \"not covered\"), shows its listing and asks no company profile", () => {
        route.ticker = "ACA";

        vi.mocked(useV2Company).mockClear();

        vi.mocked(useInstrument).mockReturnValue({
            data: ACA_INSTRUMENT,
            isLoading: false,
        } as never);

        render(<TickerOverview />);

        expect(screen.getByText("ACA is delisted")).toBeInTheDocument();

        expect(screen.getByText(/ACA is delisted\. Its eligible history .*Its SEC filer record stays available\./)).toBeInTheDocument();

        expect(screen.getByRole("link", { name: "SEC filer record" })).toHaveAttribute("href", "/sec/0001739445");

        // On the Overview itself: no link back to it.
        expect(screen.queryByRole("link", { name: "The listing" })).toBeNull();

        // The notice's badge and the listing's Status stat.
        expect(screen.getAllByText("Delisted")).toHaveLength(2);

        expect(screen.queryByText(/not covered/i)).toBeNull();

        expect(useV2Company).not.toHaveBeenCalled();
    });
});
