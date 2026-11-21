// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FundCompositionList, FundWeightsBlock } from "@/components/sec/fund-views";
import { ApiRequestError } from "@/lib/api/errors";
import {
    V2_FUND_POSITIONS,
    V2_FUND_POSITIONS_LEVERAGED,
    V2_FUND_POSITIONS_SINGLE_ASSET,
    V2_FUND_WEIGHTS,
} from "@/lib/sec/v2-fixtures";

afterEach(cleanup);

const list = { hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

const problem = (status: number, code: string, detail: string) => new ApiRequestError(status, { error: code, message: detail });

describe("Fund holdings (`/v1/funds/{fund}/holdings`)", () => {
    it("the source + as-of badge, the top positions as stated, and 'Load more' for the next page", () => {
        render(<FundCompositionList state={{ ...list, error: null, hasNextPage: true, pages: [V2_FUND_POSITIONS] }} />);

        expect(screen.getByTestId("fund-source-badge")).toHaveTextContent("Issuer file · as of Nov 13, 2026");

        expect(screen.getByText("NVIDIA CORP")).toBeInTheDocument();

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

    it("503 while the backend switch is off is a state, not 'no weights'", () => {
        render(<FundWeightsBlock state={{ ...list, error: problem(503, "unavailable", "Switched off"), pages: [] }} />);

        expect(screen.queryByText("No weights for this composition.")).toBeNull();
    });
});
