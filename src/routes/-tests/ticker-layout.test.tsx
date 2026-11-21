// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { V2Instrument } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { useFund, useInstrument, useV2Company } from "@/lib/api/queries";
import { AAPL_INSTRUMENT, GLD_INSTRUMENT, PDI_INSTRUMENT, SPY_INSTRUMENT, VXX_INSTRUMENT } from "@/lib/instruments-fixtures";
import { Route } from "@/routes/$ticker/route";

const route = vi.hoisted(() => ({ pathname: "/AAPL", ticker: "AAPL" }));

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options, useParams: () => ({ ticker: route.ticker }) }),
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
    Outlet: () => <div data-testid="outlet" />,
    useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) => select({ location: { pathname: route.pathname } }),
}));

// The sidebar primitives need a provider and `matchMedia`; plain containers are enough here.
vi.mock("@/components/ui/sidebar", () => {
    const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

    return {
        Sidebar: Box,
        SidebarContent: Box,
        SidebarGroup: Box,
        SidebarGroupContent: Box,
        SidebarGroupLabel: Box,
        SidebarInset: Box,
        SidebarMenu: Box,
        SidebarMenuItem: Box,
    };
});

vi.mock("@/lib/api/queries", () => ({
    useFund: vi.fn(() => ({ data: null })),
    useInstrument: vi.fn(),
    useV2Company: vi.fn(() => ({ data: null })),
}));

afterEach(cleanup);

const TickerLayout = Route.options.component as React.ComponentType;

const answer = (instrument: V2Instrument) => ({ data: instrument, error: null, isLoading: false });

const show = (instrument: V2Instrument, pathname = `/${instrument.symbol}`) => {
    route.ticker = instrument.symbol;

    route.pathname = pathname;

    vi.mocked(useInstrument).mockReturnValue(answer(instrument) as never);

    render(<TickerLayout />);
};

const navLabels = () => screen.getAllByRole("link").map(link => link.textContent);

const MARKET = ["Earnings Calendar", "IPOs", "Market Holidays"];

beforeEach(() => {
    vi.clearAllMocks();
});

describe("$ticker layout: navigation from `datasets`", () => {
    it("a stock: company sections, Holders, no fund Holdings", () => {
        show(AAPL_INSTRUMENT);

        const labels = navLabels();

        expect(labels).toEqual(expect.arrayContaining(["Overview", "Filings", "Earnings Calls", "Standardized Financials", "Insider Trades", "Holders", ...MARKET]));

        expect(labels).not.toContain("Holdings");

        expect(screen.getByText("Company")).toBeInTheDocument();

        expect(screen.getByTestId("instrument-badge")).toHaveTextContent("Stock");

        expect(useV2Company).toHaveBeenLastCalledWith("AAPL");

        expect(useFund).toHaveBeenLastCalledWith("");
    });

    it("an ETF: Holdings and Holders, no financials, earnings or insider items", () => {
        show(SPY_INSTRUMENT);

        expect(navLabels()).toEqual(["Overview", "Filings", "Holdings", "Dividends", "Splits", "Holders", ...MARKET]);

        expect(screen.getByText("Fund")).toBeInTheDocument();

        expect(useFund).toHaveBeenLastCalledWith("SPY");
    });

    it("a closed-end fund keeps its earnings calls; an exchange-traded trust has no Holdings; an ETN has Holders from its datasets", () => {
        show(PDI_INSTRUMENT);

        expect(navLabels()).toContain("Earnings Calls");

        cleanup();

        show(GLD_INSTRUMENT);

        expect(navLabels()).not.toContain("Holdings");

        expect(screen.getAllByTestId("instrument-badge").map(badge => badge.textContent)).toEqual(["ETF", "Trust"]);

        cleanup();

        show(VXX_INSTRUMENT);

        expect(navLabels()).toEqual(["Overview", "Dividends", "Splits", "Holders", ...MARKET]);

        expect(screen.getByText("Note")).toBeInTheDocument();
    });

    it("a typed URL to a section the instrument lacks renders its reason, not the page", () => {
        show(GLD_INSTRUMENT, "/GLD/holdings");

        expect(screen.queryByTestId("outlet")).toBeNull();

        expect(screen.getByText(/GLD is an ETF structured as an exchange-traded trust: it files no holdings report/)).toBeInTheDocument();

        cleanup();

        show(SPY_INSTRUMENT, "/SPY/financials-standardized");

        expect(screen.getByText("SPY is an ETF: financial statements are not served for it.")).toBeInTheDocument();
    });

    it("a section mounts only once the instrument is known: no request and no refusal flash while it loads ([FU2870], [FU2838])", () => {
        route.ticker = "GLD";

        route.pathname = "/GLD/holdings";

        vi.mocked(useInstrument).mockReturnValue({ data: null, error: null, isLoading: true } as never);

        const { unmount } = render(<TickerLayout />);

        expect(screen.queryByTestId("outlet")).toBeNull();

        expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();

        expect(screen.queryByText(/files no holdings report/)).toBeNull();

        unmount();

        // A market page needs no instrument: it renders at once.
        route.pathname = "/GLD/market-holidays";

        render(<TickerLayout />);

        expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });

    it("the header shows the instrument's canonical symbol, not the URL's spelling", () => {
        route.ticker = "aapl";

        route.pathname = "/aapl/dividends";

        vi.mocked(useInstrument).mockReturnValue(answer(AAPL_INSTRUMENT) as never);

        render(<TickerLayout />);

        expect(screen.getByRole("heading", { level: 1, name: "AAPL" })).toBeInTheDocument();
    });

    it("an unknown symbol is one notice; the market pages still render under it", () => {
        route.ticker = "ZZZZ";

        route.pathname = "/ZZZZ";

        vi.mocked(useInstrument).mockReturnValue({
            data: null,
            error: new ApiRequestError(404, { error: "not_covered", message: "No instrument is known for ZZZZ (GET /v1/instruments?q=)" }),
            isLoading: false,
        } as never);

        const { unmount } = render(<TickerLayout />);

        expect(screen.getByText("ZZZZ is not a known instrument")).toBeInTheDocument();

        expect(screen.queryByTestId("outlet")).toBeNull();

        expect(navLabels()).toEqual(MARKET);

        unmount();

        route.pathname = "/ZZZZ/market-holidays";

        render(<TickerLayout />);

        expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });
});
