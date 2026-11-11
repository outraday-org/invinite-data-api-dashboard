// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api/errors";
import { V2_HOLDING_CHANGES, V2_HOLDINGS, V2_HOLDINGS_PENDING, V2_INSIDER_TRADES, V2_IPOS } from "@/lib/sec/v2-fixtures";
import { insiderRoles, InsiderTradesView } from "@/routes/$ticker/insider-trades/index";
import { changePercentText, HoldingChangesList, HoldingsList } from "@/routes/$ticker/institutions/index";
import { IposView, ipoSymbolText, offerPriceText } from "@/routes/$ticker/ipos/index";

// The page modules' routes need a router; the pure views do not.
vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
}));

// Keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    useV2HoldingChangesInfinite: vi.fn(),
    useV2HoldingsInfinite: vi.fn(),
    useV2InsiderTradesInfinite: vi.fn(),
    useV2IposInfinite: vi.fn(),
}));

afterEach(cleanup);

const list = { hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

const problem = (status: number, code: string, detail: string) => new ApiRequestError(status, { error: code, message: detail });

describe("Institutions (`/v1/holdings`, `/v1/holding-changes`)", () => {
    it("ownership rows name the institution; the line shows coverage through, the snapshot and the counting rule", () => {
        render(<HoldingsList state={{ ...list, error: null, pages: [V2_HOLDINGS] }} />);

        expect(screen.getByText("VANGUARD GROUP INC")).toHaveAttribute("title", "CIK 0000102909");

        expect(screen.getByText("$412,000,000,000.00")).toBeInTheDocument();

        const line = screen.getByTestId("v2-meta-line");

        expect(within(line).getByText("Complete")).toBeInTheDocument();

        expect(within(line).getByText("through 2026-09-30")).toBeInTheDocument();

        expect(within(line).getByText(/^Snapshot /)).toBeInTheDocument();

        expect(within(line).getByText(V2_HOLDINGS.meta.counting!)).toBeInTheDocument();
    });

    it("pending coverage: the pending notice, never 'No institutional holders'", () => {
        render(<HoldingsList state={{ ...list, error: null, pages: [V2_HOLDINGS_PENDING] }} />);

        expect(screen.getByText("Being prepared — asked again in 30 s")).toBeInTheDocument();

        expect(screen.queryByText(/No institutional holders/)).toBeNull();
    });

    it("a complete empty answer is a genuine empty", () => {
        render(<HoldingsList state={{ ...list, error: null, pages: [{ ...V2_HOLDINGS, data: [] }] }} />);

        expect(screen.getByText("No institutional holders reported for this quarter.")).toBeInTheDocument();
    });

    it("changes: type label, the fraction as a percent, a null filing date as a dash, partial coverage notice", () => {
        render(<HoldingChangesList state={{ ...list, error: null, pages: [V2_HOLDING_CHANGES] }} />);

        const row = screen.getByText("Added").closest("tr")!;

        expect(within(row).getByText("+0.36%")).toBeInTheDocument();

        expect(within(row).getAllByText("—").length).toBeGreaterThan(0);

        expect(screen.getByText("Partly available — what is shown may be incomplete")).toBeInTheDocument();

        expect(changePercentText(1)).toBe("+100%");

        expect(changePercentText(-1)).toBe("-100%");
    });

    it("503 unavailable and 404 not_covered are states", () => {
        const { unmount } = render(<HoldingChangesList state={{ ...list, error: problem(503, "unavailable", "The research provider is switched off"), pages: [] }} />);

        expect(screen.getByText("This SEC capability is not switched on yet")).toBeInTheDocument();

        expect(screen.getByText("The research provider is switched off")).toBeInTheDocument();

        unmount();

        render(<HoldingsList state={{ ...list, error: problem(404, "not_covered", "Unknown company"), pages: [] }} />);

        expect(screen.getByText("Not known to the SEC store")).toBeInTheDocument();
    });
});

describe("Insider trades (`/v1/insider-trades`)", () => {
    it("side as Buy / Sell, the officer title, no empty line for a filled page", () => {
        render(<InsiderTradesView {...list} error={null} pages={[V2_INSIDER_TRADES]} />);

        const row = screen.getByText("Cook Timothy D").closest("tr")!;

        expect(within(row).getByText("Sell")).toBeInTheDocument();

        expect(within(row).getByText("Officer (Chief Executive Officer)")).toBeInTheDocument();

        expect(within(row).getByText("$254.12")).toBeInTheDocument();

        expect(screen.queryByText(/No insider trades/)).toBeNull();
    });

    it("roles: every flag in words, 'Other' text kept, none = dash", () => {
        const [trade] = V2_INSIDER_TRADES.data;

        expect(insiderRoles({ ...trade, reporting_person_is_director: true, reporting_person_officer_title: null })).toBe("Director, Officer");

        expect(insiderRoles({ ...trade, reporting_person_is_officer: false, reporting_person_is_other: true, reporting_person_other_text: "Trustee" })).toBe("Trustee");

        expect(insiderRoles({ ...trade, reporting_person_is_officer: false })).toBe("—");
    });

    it("404 not_covered: the not-covered state, no table", () => {
        render(<InsiderTradesView {...list} error={problem(404, "not_covered", "No insider trades are stored for this company")} pages={[]} />);

        expect(screen.getByText("Not known to the SEC store")).toBeInTheDocument();

        expect(screen.queryByRole("table")).toBeNull();
    });
});

describe("IPOs (`/v1/ipos`, one row per offering)", () => {
    it("stage, exchange MIC, price range or final price, and the registration / listing source badges", () => {
        render(<IposView {...list} error={null} pages={[V2_IPOS]} />);

        const registered = screen.getByText("Rezera Inc").closest("tr")!;

        expect(within(registered).getByText("Price range")).toBeInTheDocument();

        expect(within(registered).getByText("XNAS")).toBeInTheDocument();

        expect(within(registered).getByText("$16.00 – $18.00")).toBeInTheDocument();

        expect(within(registered).getByText("RZRA (proposed)")).toBeInTheDocument();

        expect(within(registered).getByText("Registration")).toBeInTheDocument();

        expect(within(registered).queryByText("Listing")).toBeNull();

        const listed = screen.getByText("NewCo Holdings").closest("tr")!;

        expect(within(listed).getByText("Trading")).toBeInTheDocument();

        expect(within(listed).getByText("XNYS")).toBeInTheDocument();

        expect(within(listed).getByText("$21.00")).toBeInTheDocument();

        expect(within(listed).getByText("NEWCO")).toBeInTheDocument();

        expect(within(listed).getByText("Listing")).toBeInTheDocument();
    });

    it("price and symbol words", () => {
        const [registration, listing] = V2_IPOS.data;

        expect(offerPriceText({ ...registration, price_range_high: null, price_range_low: null })).toBe("—");

        expect(offerPriceText({ ...registration, currency: null, price_range_high: 16, price_range_low: 16 })).toBe("16");

        expect(ipoSymbolText({ ...registration, proposed_symbols: [] })).toBe("—");

        expect(ipoSymbolText({ ...listing, company: null })).toBe("NEWCO");
    });

    it("the plan gate (403 plan_required) is the tier state", () => {
        render(<IposView {...list} error={problem(403, "plan_required", "PRO")} pages={[]} />);

        expect(screen.getByText("STANDARD")).toBeInTheDocument();
    });
});
