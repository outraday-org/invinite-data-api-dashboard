// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { V2Instrument } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { useInstrument } from "@/lib/api/queries";
import { AAPL_INSTRUMENT, GLD_INSTRUMENT, SPY_INSTRUMENT } from "@/lib/instruments-fixtures";
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
});

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
});
