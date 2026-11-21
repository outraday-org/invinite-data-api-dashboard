// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFunds } from "@/lib/api/queries";
import { FUNDS_PAGE } from "@/lib/instruments-fixtures";
import { FundsList, fundsRequest, Route } from "@/routes/funds";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options, useNavigate: () => vi.fn(), useSearch: () => ({}) }),
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

vi.mock("@/lib/api/queries", () => ({ useFunds: vi.fn() }));

afterEach(cleanup);

const list = { error: null, hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

describe("/funds (`GET /v1/funds`)", () => {
    it("one row per fund: symbol linking its page, type badge (Trust for GLD), net assets", () => {
        render(<FundsList state={{ ...list, hasNextPage: true, pages: [FUNDS_PAGE] }} />);

        expect(screen.getByRole("link", { name: "SPY" })).toHaveAttribute("href", "/SPY");

        const gld = screen.getByRole("link", { name: "GLD" }).closest("tr")!;

        expect(within(gld).getByText("ETF")).toBeInTheDocument();

        expect(within(gld).getByText("Trust")).toBeInTheDocument();

        const pdi = screen.getByRole("link", { name: "PDI" }).closest("tr")!;

        expect(within(pdi).getByText("Closed-end fund")).toBeInTheDocument();

        expect(within(pdi).getByText("$5.2B")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });

    it("the page asks every fund without filters first", () => {
        vi.mocked(useFunds).mockReturnValue({ data: { pages: [FUNDS_PAGE] }, error: null, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false, isLoading: false } as never);

        const FundsPage = Route.options.component as React.ComponentType;

        render(<FundsPage />);

        expect(useFunds).toHaveBeenLastCalledWith({ exchange: undefined, limit: 50, q: "", sort: undefined, structure: undefined, type: undefined });

        expect(screen.getByRole("heading", { name: "Funds" })).toBeInTheDocument();
    });

    it("\"with holdings\" = registered funds; exchange and sort go to the API (symbol / name only)", () => {
        expect(fundsRequest({ exchange: "ARCX", sort: "-name", structure: "registered_fund" })).toMatchObject({
            exchange: "ARCX",
            sort: "-name",
            structure: ["registered_fund"],
        });
    });
});
