// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { INSTRUMENT_SEARCH } from "@/lib/instruments-fixtures";
import { V2_FILERS } from "@/lib/sec/v2-fixtures";
import { InstitutionsList } from "@/routes/institutions";
import { companiesRequest, InstrumentsList, instrumentsRequest } from "@/routes/instruments";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

vi.mock("@/lib/api/queries", () => ({}));

afterEach(cleanup);

const list = { error: null, hasNextPage: true, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

describe("/instruments (`GET /v1/instruments`)", () => {
    it("all four types, each row linking its page with its badges", () => {
        render(<InstrumentsList {...list} pages={[INSTRUMENT_SEARCH]} />);

        for (const symbol of ["AAPL", "TQQQ", "PDI", "VXX"]) expect(screen.getByRole("link", { name: symbol })).toHaveAttribute("href", `/${symbol}`);

        const gld = screen.getByRole("link", { name: "GLD" }).closest("tr")!;

        expect(within(gld).getByText("Trust")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });

    it("Listed (Data API 12.0): absent = listed today, nothing sent; `all` and `delisted` send `all` / `false`", () => {
        expect(instrumentsRequest({}).isActive).toBeUndefined();

        expect(instrumentsRequest({ active: "all" }).isActive).toBe("all");

        expect(instrumentsRequest({ active: "delisted" }).isActive).toBe("false");

        // The Companies tab's request (`GET /v1/companies`) has no `is_active`: the API would refuse it.
        expect(companiesRequest({ active: "all", view: "companies" }, [])).not.toHaveProperty("isActive");
    });

    it("the tab is the type; the structure goes only with a fund tab", () => {
        expect(instrumentsRequest({})).toMatchObject({ isActive: undefined, structure: undefined, type: undefined });

        expect(instrumentsRequest({ active: "delisted", structure: "registered_fund", type: "etf" })).toMatchObject({ isActive: "false", structure: ["registered_fund"], type: ["etf"] });

        expect(instrumentsRequest({ structure: "registered_fund", type: "stock" }).structure).toBeUndefined();
    });
});

describe("/institutions (`GET /v1/filers?phase=manager`)", () => {
    it("each manager opens its filer page; a listed one also its ticker", () => {
        render(<InstitutionsList {...list} pages={[V2_FILERS]} />);

        expect(screen.getByRole("link", { name: "BERKSHIRE HATHAWAY INC" })).toHaveAttribute("href", "/sec/1067983");

        expect(screen.getByRole("link", { name: "BRK-B" })).toHaveAttribute("href", "/BRK-B");
    });
});
