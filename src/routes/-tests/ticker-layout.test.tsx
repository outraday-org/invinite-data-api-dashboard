// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { V2Instrument } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { useInstrument } from "@/lib/api/queries";
import { AAPL_INSTRUMENT, ACA_INSTRUMENT, GLD_INSTRUMENT, MBSX_INSTRUMENT, REUSED_DELISTED_INSTRUMENT, SPY_INSTRUMENT, VXX_INSTRUMENT } from "@/lib/instruments-fixtures";
import { Route } from "@/routes/$ticker/route";

const route = vi.hoisted(() => ({ linkProps: [] as Array<Record<string, unknown>>, pathname: "/AAPL", ticker: "AAPL" }));

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options, useParams: () => ({ ticker: route.ticker }) }),
    Link: (props: { "aria-current"?: "page"; "children": React.ReactNode; "params": Record<string, string>; "to": string }) => {
        route.linkProps.push(props);

        return (
            <a aria-current={props["aria-current"]} href={Object.entries(props.params).reduce((path, [key, value]) => path.replace(`$${key}`, value), props.to)}>
                {props.children}
            </a>
        );
    },
    Outlet: () => <div data-testid="outlet" />,
    useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) => select({ location: { pathname: route.pathname } }),
}));

vi.mock("@/lib/api/queries", () => ({ useInstrument: vi.fn() }));

afterEach(cleanup);

const TickerLayout = Route.options.component as React.ComponentType;

const answer = (instrument: V2Instrument) => ({ data: instrument, error: null, isLoading: false });

const show = (instrument: V2Instrument, pathname = `/${instrument.symbol}`) => {
    route.ticker = instrument.symbol;

    route.pathname = pathname;

    vi.mocked(useInstrument).mockReturnValue(answer(instrument) as never);

    render(<TickerLayout />);
};

beforeEach(() => {
    vi.clearAllMocks();

    route.linkProps = [];
});

const tabs = () => within(screen.getByRole("navigation", { name: /^Sections of / })).getAllByRole("link");

const tabLabels = () => tabs().map(link => link.textContent);

const activeTab = () => tabs().filter(link => link.getAttribute("aria-current") === "page").map(link => link.textContent);

describe("$ticker layout (the sidebar's sections: app-sidebar.test.tsx)", () => {
    it("the header names the instrument with its type badges; no brand-colour dots", () => {
        show(GLD_INSTRUMENT);

        expect(screen.getAllByTestId("instrument-badge").map(badge => badge.textContent)).toEqual(["ETF", "Trust"]);

        expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });

    it("a typed URL to a section the instrument lacks renders its reason, not the page", () => {
        show(GLD_INSTRUMENT, "/GLD/holdings");

        expect(screen.queryByTestId("outlet")).toBeNull();

        expect(screen.getByText(/GLD is an ETF structured as an exchange-traded trust: it files no holdings report/)).toBeInTheDocument();

        cleanup();

        show(SPY_INSTRUMENT, "/SPY/financials");

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
    });

    it("the header shows the instrument's canonical symbol, not the URL's spelling", () => {
        route.ticker = "aapl";

        route.pathname = "/aapl/dividends";

        vi.mocked(useInstrument).mockReturnValue(answer(AAPL_INSTRUMENT) as never);

        render(<TickerLayout />);

        expect(screen.getByRole("heading", { level: 1, name: "AAPL" })).toBeInTheDocument();
    });

    it("an unknown symbol is one notice", () => {
        route.ticker = "ZZZZ";

        route.pathname = "/ZZZZ";

        vi.mocked(useInstrument).mockReturnValue({
            data: null,
            error: new ApiRequestError(404, { error: "not_covered", message: "No instrument is known for ZZZZ (GET /v1/instruments?q=)" }),
            isLoading: false,
        } as never);

        render(<TickerLayout />);

        expect(screen.getByText("ZZZZ is not a known instrument")).toBeInTheDocument();

        // The page keeps one h1 (the typed symbol) without the identity header.
        expect(screen.getByRole("heading", { level: 1, name: "ZZZZ" })).toBeInTheDocument();

        expect(screen.queryByTestId("outlet")).toBeNull();
    });

    it("a segment longer than any symbol is not known at once: no validation error, no page (UI walk F008)", () => {
        route.ticker = "this-route-does-not-exist-walk";

        route.pathname = "/this-route-does-not-exist-walk";

        // The hook is idle for it (`isSymbolParam`): no answer, no error, not loading.
        vi.mocked(useInstrument).mockReturnValue({ data: null, error: null, isLoading: false } as never);

        render(<TickerLayout />);

        expect(screen.getByText("THIS-ROUTE-DOES-NOT-EXIST-WALK is not a known instrument")).toBeInTheDocument();

        expect(screen.getByText("A symbol has at most 15 characters.")).toBeInTheDocument();

        expect(screen.queryByTestId("outlet")).toBeNull();
    });

    it("a delisted stock's supported direct URL mounts its section with eligible tabs", () => {
        show(ACA_INSTRUMENT, "/ACA/filings");

        expect(screen.getByTestId("outlet")).toBeInTheDocument();

        expect(tabLabels()).toEqual(["Overview", "Calls", "Documents", "Filings"]);
    });

    it("unsupported historical direct URLs never mount or request a section", () => {
        for (const [instrument, section] of [[ACA_INSTRUMENT, "financials"], [ACA_INSTRUMENT, "insider-trades"], [ACA_INSTRUMENT, "stock-splits"], [REUSED_DELISTED_INSTRUMENT, "dividends"], [MBSX_INSTRUMENT, "holdings"]] as const) {
            show(instrument, `/${instrument.symbol}/${section}`);

            expect(screen.queryByTestId("outlet")).toBeNull();

            expect(screen.getByText("Not served")).toBeInTheDocument();

            cleanup();
        }
    });

    it("a delisted symbol's Overview mounts (its listing)", () => {
        show({ ...SPY_INSTRUMENT, is_active: false }, "/SPY");

        expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });

    describe("section tabs (the sidebar context group's twin)", () => {
        it("follow the instrument's datasets: a stock without Holdings, a fund without Financials / Calls, a trust, an ETN", () => {
            show(AAPL_INSTRUMENT);

            expect(screen.getByRole("navigation", { name: "Sections of AAPL" })).toBeInTheDocument();

            expect(tabLabels()).toEqual(["Overview", "Calls", "Documents", "Filings", "Financials", "Holders", "Insider trades", "Dividends", "Splits", "News"]);

            cleanup();

            show(SPY_INSTRUMENT);

            expect(tabLabels()).toEqual(["Overview", "Filings", "Holders", "Holdings", "Dividends", "Splits"]);

            cleanup();

            show(GLD_INSTRUMENT);

            expect(tabLabels()).toEqual(["Overview", "Filings", "Holders", "Dividends", "Splits"]);

            cleanup();

            show(VXX_INSTRUMENT);

            expect(tabLabels()).toEqual(["Overview", "Holders", "Dividends", "Splits"]);
        });

        it("the active tab is the section of the URL; a call page keeps Calls; a gated section none", () => {
            show(AAPL_INSTRUMENT, "/AAPL/filings");

            expect(activeTab()).toEqual(["Filings"]);

            cleanup();

            show(AAPL_INSTRUMENT, "/AAPL");

            expect(activeTab()).toEqual(["Overview"]);

            cleanup();

            show(AAPL_INSTRUMENT, "/AAPL/earnings-calls/evt_123");

            expect(activeTab()).toEqual(["Calls"]);

            cleanup();

            show(GLD_INSTRUMENT, "/GLD/holdings");

            expect(activeTab()).toEqual([]);
        });

        it("links point at the section of the URL's symbol and carry no search params", () => {
            show(AAPL_INSTRUMENT, "/AAPL/dividends");

            expect(tabs().map(link => link.getAttribute("href"))).toContain("/AAPL/insider-trades");

            expect(route.linkProps.length).toBeGreaterThan(0);

            expect(route.linkProps.every(props => !("search" in props))).toBe(true);
        });

        it("a skeleton row while the instrument loads; no tabs for an unknown symbol", () => {
            route.ticker = "AAPL";

            route.pathname = "/AAPL";

            vi.mocked(useInstrument).mockReturnValue({ data: null, error: null, isLoading: true } as never);

            render(<TickerLayout />);

            expect(screen.getByTestId("section-tabs-skeleton")).toBeInTheDocument();

            expect(screen.getByRole("heading", { level: 1, name: "AAPL" })).toBeInTheDocument();

            cleanup();

            route.ticker = "ZZZZ";

            route.pathname = "/ZZZZ";

            vi.mocked(useInstrument).mockReturnValue({ data: null, error: new ApiRequestError(404, { error: "not_covered", message: "No instrument" }), isLoading: false } as never);

            render(<TickerLayout />);

            expect(screen.queryByRole("navigation")).toBeNull();

            expect(screen.queryByTestId("section-tabs-skeleton")).toBeNull();
        });
    });
});
