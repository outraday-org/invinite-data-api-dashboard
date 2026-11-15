// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EtfCompositionList, EtfHoldersList, EtfWeightsBlock } from "@/components/sec/etf-views";
import { ApiRequestError } from "@/lib/api/errors";
import {
    V2_ETF_HOLDERS,
    V2_ETF_HOLDINGS,
    V2_ETF_HOLDINGS_LEVERAGED,
    V2_ETF_HOLDINGS_SINGLE_ASSET,
    V2_ETF_WEIGHTS,
} from "@/lib/sec/v2-fixtures";

afterEach(cleanup);

const list = { hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

const problem = (status: number, code: string, detail: string) => new ApiRequestError(status, { error: code, message: detail });

describe("ETF holdings (`/v1/etf-holdings?etf=`)", () => {
    it("the source + as-of badge, the top positions as stated, and 'Load more' for the next page", () => {
        render(<EtfCompositionList state={{ ...list, error: null, hasNextPage: true, pages: [V2_ETF_HOLDINGS] }} />);

        expect(screen.getByTestId("etf-source-badge")).toHaveTextContent("Issuer file · as of 2026-11-13");

        expect(screen.getByText("NVIDIA CORP")).toBeInTheDocument();

        expect(screen.getByText("7.41%")).toBeInTheDocument();

        expect(screen.getByText("$52,400,000,000")).toBeInTheDocument();

        expect(screen.queryByText("Notional")).toBeNull();

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });

    it("a leveraged fund shows the notional exposure of its swap lines; a weight it does not state stays '—'", () => {
        render(<EtfCompositionList state={{ ...list, error: null, pages: [V2_ETF_HOLDINGS_LEVERAGED] }} />);

        expect(screen.getByText("Notional")).toBeInTheDocument();

        expect(screen.getByText("$9,800,000,000")).toBeInTheDocument();

        expect(screen.getAllByText("—", { selector: "div.text-right" }).length).toBeGreaterThan(0);

        expect(screen.queryByText(/%$/)).toBeNull();
    });

    it("a single-asset trust is a notice, never an empty table; 404 not_covered is a state", () => {
        render(<EtfCompositionList state={{ ...list, error: null, pages: [V2_ETF_HOLDINGS_SINGLE_ASSET] }} />);

        expect(screen.getByText("This fund holds one asset; there is no holdings list.")).toBeInTheDocument();

        expect(screen.queryByText("No positions in this composition.")).toBeNull();

        cleanup();

        render(<EtfCompositionList state={{ ...list, error: problem(404, "not_covered", "Not an ETF"), pages: [] }} />);

        expect(screen.queryByText("No positions in this composition.")).toBeNull();
    });
});

describe("ETF weights (`/v1/etf-weights`)", () => {
    it("one block per dimension with its buckets (Unclassified shown as a bucket) and the basis note", () => {
        render(<EtfWeightsBlock state={{ ...list, error: null, pages: [V2_ETF_WEIGHTS] }} />);

        const block = screen.getByTestId("etf-weights");

        expect(within(block).getByText("Sector")).toBeInTheDocument();

        expect(within(block).getByText("Information Technology")).toBeInTheDocument();

        expect(within(block).getByText("31.2%")).toBeInTheDocument();

        expect(within(block).getByText("Unclassified")).toBeInTheDocument();

        expect(within(block).getByText("Basis: as stated by the issuer")).toBeInTheDocument();

        expect(within(block).getByText("Basis: partly derived, not classified")).toBeInTheDocument();
    });

    it("503 while the backend switch is off is a state, not 'no weights'", () => {
        render(<EtfWeightsBlock state={{ ...list, error: problem(503, "unavailable", "Switched off"), pages: [] }} />);

        expect(screen.queryByText("No weights for this composition.")).toBeNull();
    });
});

describe("Institutions: ETFs (daily) tab (`/v1/etf-holdings?company=`)", () => {
    it("one row per ETF with its own source + as-of; the scope line says it is not every ETF", () => {
        render(<EtfHoldersList state={{ ...list, error: null, pages: [V2_ETF_HOLDERS] }} />);

        expect(screen.getByText("SPY")).toHaveAttribute("title", "SPDR S&P 500 ETF Trust");

        expect(screen.getByText("Issuer file (monthly) · as of 2026-10-31")).toBeInTheDocument();

        expect(screen.getByTestId("etf-holders-scope")).toHaveTextContent("412 ETFs — not every ETF");
    });

    it("a complete empty answer is a genuine empty", () => {
        render(<EtfHoldersList state={{ ...list, error: null, pages: [{ ...V2_ETF_HOLDERS, data: [] }] }} />);

        expect(screen.getByText("No ETF with an issuer holdings file holds this company.")).toBeInTheDocument();
    });
});
