// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2FilerResponse } from "@/lib/api/types";

import { cikOf, SecFilerMatches } from "@/components/sec/sec-filer-lookup";
import { SecFilerHeader, SecFilingsView, SecLifecycleView, SecPortfolioView } from "@/components/sec/sec-filer-views";
import { ApiRequestError } from "@/lib/api/errors";
import { V2_FILERS, V2_FILINGS, V2_HOLDINGS, V2_HOLDINGS_PENDING } from "@/lib/sec/v2-fixtures";

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

describe("SecPortfolioView (`/v1/holdings?filer=`)", () => {
    const view = (props: Partial<Parameters<typeof SecPortfolioView>[0]>) => (
        <SecPortfolioView error={null} hasNextPage={false} isFetchingNextPage={false} isLoading={false} onMore={() => undefined} pages={[]} {...props} />
    );

    it("lists the positions with the page's provenance; 'More positions' while a cursor remains", () => {
        const onMore = vi.fn();

        render(view({ hasNextPage: true, onMore, pages: [V2_HOLDINGS] }));

        expect(screen.getByText("AAPL")).toBeInTheDocument();

        expect(screen.getByText("037833100")).toBeInTheDocument();

        expect(screen.getByText("$412,000,000,000")).toBeInTheDocument();

        expect(screen.getByTestId("v2-meta-line")).toHaveTextContent("through 2026-09-30");

        fireEvent.click(screen.getByRole("button", { name: "More positions" }));

        expect(onMore).toHaveBeenCalledOnce();
    });

    it("a pending quarter is its notice, never 'no positions'", () => {
        render(view({ pages: [V2_HOLDINGS_PENDING] }));

        expect(screen.getByText("Being prepared — asked again in 30 s")).toBeInTheDocument();

        expect(screen.queryByText(/reported no positions/)).toBeNull();
    });
});
