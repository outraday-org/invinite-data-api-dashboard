// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LandingData } from "@/routes/index";

import { CALENDAR_EVENT } from "@/lib/earnings/calendar-fixtures";
import { V2_IPOS } from "@/lib/sec/v2-fixtures";
import { LandingView } from "@/routes/index";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, params = {}, search, to }: { children: React.ReactNode; params?: Record<string, string>; search?: Record<string, string>; to: string }) => {
        const path = Object.entries(params).reduce((value, [key, param]) => value.replace(`$${key}`, param), to);

        const query = new URLSearchParams(search ?? {}).toString();

        return <a href={query ? `${path}?${query}` : path}>{children}</a>;
    },
}));

vi.mock("@/lib/api/queries", () => ({}));

afterEach(cleanup);

const today = "2026-11-04";

const data: LandingData = {
    holiday: { data: { day: "2026-11-26", end_time: null, event_name: "Thanksgiving Day", start_time: null }, isLoading: false },
    ipos: { data: [V2_IPOS.data[1]], isLoading: false },
    live: { asOf: new Date("2026-11-04T13:50:00Z"), data: [CALENDAR_EVENT], isLoading: false },
    recents: [
        { badge: "Stock", kind: "instrument", label: "AAPL", name: "Apple Inc.", ref: "AAPL" },
        { badge: "Institution", kind: "filer", label: "VANGUARD GROUP INC", name: "CIK 102909", ref: "102909" },
    ],
    today,
    week: { data: [CALENDAR_EVENT, { ...CALENDAR_EVENT, event_id: "later", scheduled_at: "2026-11-06T13:30:00.000Z", symbol: "LATER" }], isLoading: false },
};

describe("landing page (with a valid key)", () => {
    it("a failed block says so instead of \"nothing ahead\"", () => {
        render(<LandingView {...data} holiday={{ data: null, failed: true, isLoading: false }} ipos={{ data: [], failed: true, isLoading: false }} />);

        expect(screen.getAllByText(/Could not load this block/)).toHaveLength(2);

        expect(screen.queryByText("No holiday announced ahead.")).toBeNull();

        expect(screen.queryByText("No IPO with a listing date ahead.")).toBeNull();
    });

    it("live calls, today's and the week's earnings, next IPOs and the next holiday from the answers", () => {
        render(<LandingView {...data} />);

        expect(within(screen.getByTestId("landing-live")).getByText("MLCO")).toBeInTheDocument();

        const todayBlock = screen.getByText("Earnings today").closest("[data-slot=card]")!;

        expect(within(todayBlock as HTMLElement).getByText("MLCO")).toBeInTheDocument();

        const laterBlock = screen.getByText("Later this week").closest("[data-slot=card]")!;

        expect(within(laterBlock as HTMLElement).getByText("LATER")).toBeInTheDocument();

        expect(within(screen.getByTestId("landing-ipos")).getByRole("link", { name: "NEWCO" })).toHaveAttribute("href", "/NEWCO");

        expect(within(screen.getByTestId("landing-holiday")).getByText("Thanksgiving Day")).toBeInTheDocument();
    });

    it("the Browse cards come from the navigation table, each with its filter", () => {
        render(<LandingView {...data} />);

        const cards = within(screen.getByTestId("browse-cards")).getAllByRole("link");

        expect(cards.map(card => card.getAttribute("href"))).toEqual([
            "/instruments?type=stock",
            "/instruments?type=etf",
            "/instruments?type=closed_end_fund",
            "/instruments?type=etn",
            "/funds?structure=registered_fund",
            "/institutions",
            "/spot-coins",
            "/us-macro/inflation",
            "/us-macro/gdp",
            "/us-macro/labor",
            "/us-macro/yield-curve",
        ]);
    });

    it("recently opened: instruments and institutions", () => {
        render(<LandingView {...data} />);

        const recents = within(screen.getByTestId("landing-recents")).getAllByRole("link").map(link => link.getAttribute("href"));

        expect(recents).toEqual(["/AAPL", "/sec/102909"]);
    });

    it("says so when nothing is live", () => {
        render(<LandingView {...data} live={{ ...data.live, data: [] }} />);

        expect(screen.getByText("No call is live right now.")).toBeInTheDocument();
    });
});
