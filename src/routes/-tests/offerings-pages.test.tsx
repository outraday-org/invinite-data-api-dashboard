// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api/errors";
import { V2_OFFERING_DETAIL, V2_OFFERINGS } from "@/lib/sec/v2-fixtures";
import { OfferingDetailView } from "@/routes/offerings/$offeringId";
import { OfferingsList } from "@/routes/offerings/index";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, params, to }: { children: React.ReactNode; params?: Record<string, string>; to: string }) => (
        <a href={Object.entries(params ?? {}).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

// Keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({ useOffering: vi.fn(), useV2OfferingsInfinite: vi.fn() }));

afterEach(cleanup);

const list = { hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

describe("/offerings (`GET /v1/offerings` without company)", () => {
    it("one row per offering with its issuer (filer page) and detail link, exemptions in words, export and Load more", () => {
        render(<OfferingsList {...list} error={null} hasNextPage pages={[V2_OFFERINGS]} />);

        expect(screen.getByRole("link", { name: "021-528681" })).toHaveAttribute("href", "/offerings/021-528681");

        const row = screen.getByRole("link", { name: "021-528681" }).closest("tr")!;

        expect(within(row).getByRole("link", { name: "Example Growth Fund II, L.P." })).toHaveAttribute("href", "/sec/1991882");

        expect(within(row).getByText("Rule 506(c), ICA 3(c)(7)")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });

    it("a refused filter (400) is a state, never an empty table", () => {
        render(<OfferingsList {...list} error={new ApiRequestError(400, { error: "invalid_parameter", message: "industry: too short" })} pages={[]} />);

        expect(screen.queryByText("No offering matches these filters.")).toBeNull();

        expect(screen.queryByRole("table")).toBeNull();
    });
});

describe("/offerings/$offeringId (`GET /v1/offerings/{offering_id}`)", () => {
    it("amounts incl. remaining, minimum and commissions; issuer + co-issuer links; related persons; the filings with the latest marked", () => {
        render(<OfferingDetailView offering={V2_OFFERING_DETAIL} />);

        const detail = screen.getByTestId("offering-detail");

        // The size is exact like sold / remaining, not "$150M" beside "$62,500,000" (UI walk F087).
        expect(within(detail).getByText("Offering size").nextSibling).toHaveTextContent(/^\$\d{1,3}(,\d{3})+$/);

        expect(within(detail).getByText("Remaining").nextSibling).toHaveTextContent("$62,500,000");

        expect(within(detail).getByText("Minimum investment").nextSibling).toHaveTextContent("$250,000");

        expect(within(detail).getByText("Sales commissions").nextSibling).toHaveTextContent("$1,250,000");

        expect(within(detail).getByText("Finders' fees").nextSibling).toHaveTextContent("$0");

        expect(within(detail).getByText("Investors").nextSibling).toHaveTextContent("42");

        expect(within(detail).getByRole("link", { name: "Example Growth Fund II, L.P." })).toHaveAttribute("href", "/sec/1991882");

        expect(within(detail).getByRole("link", { name: "CIK 1991883" })).toHaveAttribute("href", "/sec/1991883");

        expect(within(detail).getByText("Exemptions").nextSibling).toHaveTextContent("Rule 506(c) (06c), ICA 3(c)(7) (3C.7)");

        expect(within(detail).getByText("Example GP LLC").closest("tr")).toHaveTextContent("Promoter");

        expect(within(detail).getByText("Latest").closest("li")).toHaveTextContent("0001991882-26-000009");
    });

    it("an indefinite offering says so for its size and what remains", () => {
        render(<OfferingDetailView offering={{ ...V2_OFFERINGS.data[1] }} />);

        const detail = screen.getByTestId("offering-detail");

        expect(within(detail).getByText("Offering size").nextSibling).toHaveTextContent("Indefinite");

        expect(within(detail).getByText("Remaining").nextSibling).toHaveTextContent("Indefinite");

        expect(within(detail).getByText("First sale").nextSibling).toHaveTextContent("Yet to occur");

        expect(within(detail).getByText("No related person was filed.")).toBeInTheDocument();
    });
});
