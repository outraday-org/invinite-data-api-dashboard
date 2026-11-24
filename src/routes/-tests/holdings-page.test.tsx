import type * as React from "react";

// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FundCompositionList, FundSourceBadge, FundWeightsBlock } from "@/components/sec/fund-views";
import { ApiRequestError } from "@/lib/api/errors";
import { weightSumText } from "@/lib/sec/fund";
import {
    V2_FUND_POSITIONS,
    V2_FUND_POSITIONS_CLASSIFIED,
    V2_FUND_POSITIONS_LEVERAGED,
    V2_FUND_POSITIONS_SINGLE_ASSET,
    V2_FUND_WEIGHTS,
    V2_FUND_WEIGHTS_LEVERAGED,
} from "@/lib/sec/v2-fixtures";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

afterEach(cleanup);

const list = { hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

const problem = (status: number, code: string, detail: string) => new ApiRequestError(status, { error: code, message: detail });

describe("Fund holdings (`/v1/funds/{fund}/holdings`)", () => {
    it("the source + as-of badge (the page's filter bar), the top positions as stated, and 'Load more' for the next page", () => {
        render(<FundSourceBadge asOf={V2_FUND_POSITIONS.meta.as_of} source={V2_FUND_POSITIONS.meta.source} />);

        expect(screen.getByTestId("fund-source-badge")).toHaveTextContent("Issuer file · as of Nov 13, 2026");

        cleanup();

        render(<FundCompositionList state={{ ...list, error: null, hasNextPage: true, pages: [V2_FUND_POSITIONS] }} />);

        // The badge is the page's, not the list's.
        expect(screen.queryByTestId("fund-source-badge")).toBeNull();

        // A position with a ticker opens that instrument (as stated; no request per row).
        expect(screen.getByRole("link", { name: "NVIDIA CORP" })).toHaveAttribute("href", "/NVDA");

        expect(screen.getByText("7.41%")).toBeInTheDocument();

        expect(screen.getByText("$52,400,000,000")).toBeInTheDocument();

        expect(screen.queryByText("Notional")).toBeNull();

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });

    it("a leveraged fund shows the notional exposure of its swap lines; a weight it does not state stays '—'", () => {
        render(<FundCompositionList state={{ ...list, error: null, pages: [V2_FUND_POSITIONS_LEVERAGED] }} />);

        expect(screen.getByText("Notional")).toBeInTheDocument();

        expect(screen.getByText("$9,800,000,000")).toBeInTheDocument();

        expect(screen.getAllByText("—", { selector: "div.text-right" }).length).toBeGreaterThan(0);

        expect(screen.queryByText(/%$/)).toBeNull();
    });

    it("ISIN, sector and country with their basis as a short tag (the basis in words on hover)", () => {
        render(<FundCompositionList state={{ ...list, error: null, pages: [V2_FUND_POSITIONS_CLASSIFIED] }} />);

        const row = screen.getByRole("link", { name: "APPLE INC" }).closest("tr")!;

        expect(within(row).getByText("US0378331005")).toBeInTheDocument();

        expect(within(row).getByText("Information Technology").closest("span")).toHaveAttribute("title", "derived from SEC industry codes");

        expect(within(row).getByText("SIC")).toBeInTheDocument();

        expect(within(row).getByText("N-PORT")).toBeInTheDocument();
    });

    it("a single-asset answer is a notice, never an empty table; a 404 refusal is a state", () => {
        render(<FundCompositionList state={{ ...list, error: null, pages: [V2_FUND_POSITIONS_SINGLE_ASSET] }} />);

        expect(screen.getByText("This fund holds one asset; there is no holdings list.")).toBeInTheDocument();

        expect(screen.queryByText("No positions in this composition.")).toBeNull();

        cleanup();

        render(<FundCompositionList state={{ ...list, error: problem(404, "not_covered", "AAPL is a stock, not a fund (GET /v1/companies/AAPL)"), pages: [] }} />);

        expect(screen.getByText("AAPL is a stock, not a fund (GET /v1/companies/AAPL)")).toBeInTheDocument();

        expect(screen.queryByText("No positions in this composition.")).toBeNull();
    });
});

describe("Fund weights (`/v1/funds/{fund}/weights`)", () => {
    it("one block per dimension with its buckets (Unclassified shown as a bucket) and the basis note", () => {
        render(<FundWeightsBlock state={{ ...list, error: null, pages: [V2_FUND_WEIGHTS] }} />);

        const block = screen.getByTestId("fund-weights");

        expect(within(block).getByText("Sector")).toBeInTheDocument();

        expect(within(block).getByText("Information Technology")).toBeInTheDocument();

        expect(within(block).getByText("31.2%")).toBeInTheDocument();

        expect(within(block).getByText("Unclassified")).toBeInTheDocument();

        expect(within(block).getByText("Basis: as stated by the issuer")).toBeInTheDocument();

        expect(within(block).getByText("Basis: partly derived, not classified")).toBeInTheDocument();
    });

    it("the weight sum with its basis; a leveraged fund's sum is said to be far from 100 %", () => {
        render(<FundWeightsBlock state={{ ...list, error: null, pages: [V2_FUND_WEIGHTS_LEVERAGED] }} />);

        expect(screen.getByTestId("fund-weight-sum")).toHaveTextContent(
            "Each dimension sums to 300.2 % (market value over the stated net assets) — far from 100 %: derivatives count at their notional exposure.",
        );

        expect(weightSumText({ weight_basis: "issuer_stated", weight_pct_sum: 100.02 })).toBe("Each dimension sums to 100.02 % (each weight as stated in the issuer file).");

        expect(weightSumText({ weight_basis: null, weight_pct_sum: null })).toBeNull();
    });

    it("no bucket by design (weights_unavailable) says why, even on a partial answer", () => {
        render(<FundWeightsBlock state={{ ...list, error: null, pages: [{ ...V2_FUND_WEIGHTS_LEVERAGED, data: [], meta: { coverage: { state: "partial" }, reason: "weights_unavailable", weight_basis: "none", weight_pct_sum: null } }] }} />);

        expect(screen.getByTestId("fund-weights-reason")).toHaveTextContent("No weights for this composition.");
    });

    it("503 while the backend switch is off is a state, not 'no weights'", () => {
        render(<FundWeightsBlock state={{ ...list, error: problem(503, "unavailable", "Switched off"), pages: [] }} />);

        expect(screen.queryByText("No weights for this composition.")).toBeNull();
    });
});
