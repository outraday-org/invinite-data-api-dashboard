// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toUsageWindow } from "@/lib/account";
import { ME_PRO, USAGE_7D } from "@/lib/account-fixtures";
import { AccountFamilies, AccountPlanLine, AccountSummary, UsageView } from "@/routes/account";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

vi.mock("@/lib/api/queries", () => ({ useMe: vi.fn(), useMyUsage: vi.fn() }));

afterEach(cleanup);

describe("/account (`/v1/me`, `/v1/me/usage`)", () => {
    it("plan, limits, credits and the allowed families", () => {
        render(
            <>
                <AccountPlanLine me={ME_PRO} />
                <AccountSummary me={ME_PRO} />
                <AccountFamilies me={ME_PRO} />
            </>,
        );

        expect(screen.getByTestId("account-plan")).toHaveTextContent("PRO");

        expect(screen.getByText("100 req/s · 1,000 req/min")).toBeInTheDocument();

        expect(screen.getByRole("heading", { name: "Credits" })).toBeInTheDocument();

        expect(screen.getByText("3,728,983")).toBeInTheDocument();

        expect(screen.getByText("271,017 of 4,000,000")).toBeInTheDocument();

        expect(screen.getByText("SEC Filings")).toBeInTheDocument();

        expect(screen.getByText("Example Capital")).toBeInTheDocument();
    });

    it("shows the Macro family returned for a Free catalog key", () => {
        render(<AccountFamilies me={{ ...ME_PRO, allowed_families: ["Macro"], plan: "free" }} />);

        expect(screen.getByText("Macro")).toBeInTheDocument();
    });

    it("never shows the account id, also when the account has no name", () => {
        render(<AccountPlanLine me={{ ...ME_PRO, account: { ...ME_PRO.account, name: null } }} />);

        expect(screen.queryByText(ME_PRO.account.id)).not.toBeInTheDocument();
    });

    it("usage: the daily chart's totals, one row per family and per caller", () => {
        render(<UsageView usage={USAGE_7D} />);

        expect(screen.getByRole("img")).toHaveAttribute(
            "aria-label",
            "Credits per UTC day, last 7 days: 200,785 credits, 7,654 requests, 5 error responses",
        );

        const family = screen.getByText("SEC Filings").closest("tr")!;

        expect(within(family).getByText("199,585")).toBeInTheDocument();

        const oauth = screen.getAllByText("Signed-in user", { selector: "td" })[0].closest("tr")!;

        expect(within(oauth).getByText("—")).toBeInTheDocument();
    });

    it("the usage chart mounts without recharts' -1 × -1 size warning (UI walk F010)", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        render(<UsageView usage={USAGE_7D} />);

        expect(warn.mock.calls.filter(call => String(call[0]).includes("of chart should be greater than 0"))).toEqual([]);

        warn.mockRestore();
    });

    it("the window is 7, 30 or 90 days (else the API's default 30)", () => {
        expect(toUsageWindow("7")).toBe(7);

        expect(toUsageWindow("45")).toBe(30);

        expect(toUsageWindow(undefined)).toBe(30);
    });
});
