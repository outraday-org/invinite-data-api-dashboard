// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFunds } from "@/lib/api/queries";
import { FUNDS_PAGE } from "@/lib/instruments-fixtures";
import { FundsList, fundsRequest, Route } from "@/routes/funds";

const route = vi.hoisted(() => ({ navigate: vi.fn(), search: {} as Record<string, string> }));

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options, useNavigate: () => route.navigate, useSearch: () => route.search }),
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

vi.mock("@/lib/api/queries", () => ({ useFunds: vi.fn() }));

afterEach(() => {
    cleanup();

    route.search = {};
});

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

        expect(useFunds).toHaveBeenLastCalledWith({ exchange: undefined, isActive: undefined, limit: 50, q: "", sort: undefined, structure: undefined, type: undefined });

        expect(screen.getByRole("heading", { name: "Funds" })).toBeInTheDocument();
    });

    it("Listed (Data API 12.0): absent = listed today, nothing sent; `all` / `delisted` send `all` / `false`", () => {
        expect(fundsRequest({}).isActive).toBeUndefined();

        expect(fundsRequest({ active: "all" }).isActive).toBe("all");

        expect(fundsRequest({ active: "delisted" }).isActive).toBe("false");
    });

    it("`?active=all` asks listed and delisted funds; Reset filters clears it", () => {
        vi.mocked(useFunds).mockReturnValue({ data: { pages: [FUNDS_PAGE] }, error: null, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false, isLoading: false } as never);

        route.search = { active: "all" };

        const FundsPage = Route.options.component as React.ComponentType;

        render(<FundsPage />);

        expect(useFunds).toHaveBeenLastCalledWith(expect.objectContaining({ isActive: "all" }));

        fireEvent.click(screen.getByRole("button", { name: /reset filters/i }));

        const patch = route.navigate.mock.lastCall![0] as { search: (prev: Record<string, string>) => Record<string, unknown> };

        expect(patch.search({ active: "all", q: "spy" })).toMatchObject({ active: undefined, q: undefined });
    });

    it("the Delisted filter badges every row and words the empty state", () => {
        render(<FundsList delisted state={{ ...list, pages: [FUNDS_PAGE] }} />);

        const spy = screen.getByRole("link", { name: "SPY" }).closest("tr")!;

        expect(within(spy).getByText("Delisted")).toBeInTheDocument();

        cleanup();

        render(<FundsList delisted state={{ ...list, pages: [{ ...FUNDS_PAGE, data: [] }] }} />);

        expect(screen.getByText("No delisted fund matches these filters.")).toBeInTheDocument();
    });

    it("\"with holdings\" = registered funds; exchange and sort go to the API (symbol / name only)", () => {
        expect(fundsRequest({ exchange: "ARCX", sort: "-name", structure: "registered_fund" })).toMatchObject({
            exchange: "ARCX",
            sort: "-name",
            structure: ["registered_fund"],
        });
    });
});
