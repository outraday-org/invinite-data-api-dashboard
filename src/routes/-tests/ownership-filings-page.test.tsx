// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BeneficialOwnershipList, InsiderSaleNoticesList } from "@/components/sec/ownership-forms-views";
import { ApiRequestError } from "@/lib/api/errors";
import { V2_BENEFICIAL_OWNERSHIP, V2_INSIDER_SALE_NOTICES } from "@/lib/sec/v2-fixtures";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, params, to }: { children: React.ReactNode; params?: Record<string, string>; to: string }) => (
        <a href={Object.entries(params ?? {}).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

afterEach(cleanup);

const list = { exportScope: "AAPL", hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

describe("/ownership-filings · 13D / 13G (`GET /v1/beneficial-ownership`)", () => {
    it("one row per filing: company, schedule, form, class, holders with shares and % of class, chain, EDGAR link, Load more", () => {
        render(<BeneficialOwnershipList {...list} error={null} hasNextPage pages={[V2_BENEFICIAL_OWNERSHIP]} />);

        const latest = screen.getByText("after 0000102909-24-000877").closest("tr")!;

        expect(within(latest).getByText("Latest")).toBeInTheDocument();

        expect(within(latest).getByRole("link", { name: "AAPL" })).toHaveAttribute("href", "/AAPL");

        expect(within(latest).getByText("13G · passive")).toBeInTheDocument();

        expect(within(latest).getByText("SCHEDULE 13G/A")).toBeInTheDocument();

        expect(within(latest).getByText("Amendment 12")).toBeInTheDocument();

        expect(within(latest).getByText("Common Stock")).toHaveAttribute("title", "CUSIP 037833100");

        expect(within(latest).getByRole("link", { name: "VANGUARD GROUP INC" })).toHaveAttribute("href", "/sec/102909");

        expect(within(latest).getByText("153,451,954 sh · 9.92%")).toBeInTheDocument();

        expect(within(latest).getByRole("link", { name: "EDGAR" })).toHaveAttribute("href", V2_BENEFICIAL_OWNERSHIP.data[0].filing_url);

        // The filing it follows reads as superseded (the full chain, row by row).
        expect(screen.getByText("Superseded").closest("tr")).toHaveTextContent("150,000,000 sh · 9.5%");

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    });

    it("a 13D without a ticker links the filer page; no structured cover page says so", () => {
        render(<BeneficialOwnershipList {...list} error={null} pages={[V2_BENEFICIAL_OWNERSHIP]} />);

        const row = screen.getByText("13D · activist").closest("tr")!;

        expect(within(row).getByRole("link", { name: "CIK 1234567" })).toHaveAttribute("href", "/sec/1234567");

        expect(within(row).getByText("No structured form filed: open it on EDGAR")).toBeInTheDocument();
    });

    it("a refused request (400) is a state, never an empty table", () => {
        render(<BeneficialOwnershipList {...list} error={new ApiRequestError(400, { error: "invalid_parameter", message: "company or filer is required" })} pages={[]} />);

        expect(screen.queryByRole("table")).toBeNull();

        expect(screen.queryByText("No Schedule 13D / 13G filing matches these filters.")).toBeNull();
    });
});

describe("/ownership-filings · Form 144 (`GET /v1/insider-sale-notices`)", () => {
    it("seller, relationships, shares to sell, market value, sale date, broker and the replaces / replaced-by markers", () => {
        render(<InsiderSaleNoticesList {...list} error={null} pages={[V2_INSIDER_SALE_NOTICES]} />);

        const amendment = screen.getByText("Replaces 0001959173-25-006421").closest("tr")!;

        expect(within(amendment).getByRole("link", { name: "COOK TIMOTHY D" })).toHaveAttribute("href", "/sec/1214156");

        expect(within(amendment).getByText("Officer, Director")).toBeInTheDocument();

        expect(within(amendment).getByText("100,000")).toBeInTheDocument();

        expect(within(amendment).getByText("$25,780,000")).toBeInTheDocument();

        expect(within(amendment).getByText("Oct 6, 2025")).toBeInTheDocument();

        expect(within(amendment).getByText("Morgan Stanley Smith Barney LLC")).toBeInTheDocument();

        expect(within(amendment).getByText("144/A")).toBeInTheDocument();

        const original = screen.getByText("Replaced by 0001959173-25-006500").closest("tr")!;

        expect(within(original).getByRole("link", { name: "EDGAR" })).toHaveAttribute("href", V2_INSIDER_SALE_NOTICES.data[1].filing_url);

        expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();
    });
});
