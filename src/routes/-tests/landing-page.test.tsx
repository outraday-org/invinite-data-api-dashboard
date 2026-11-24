// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LandingData } from "@/routes/index";

import { CALENDAR_EVENT } from "@/lib/earnings/calendar-fixtures";
import { API_FAMILIES, API_FAMILY_OPERATIONS } from "@/lib/navigation";
import { V2_IPOS } from "@/lib/sec/v2-fixtures";
import { useRequestPanelStore } from "@/lib/stores/request-panel-store";
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
    it("the intro's \"API\" button opens the request panel", () => {
        useRequestPanelStore.setState({ open: false });

        render(<LandingView {...data} />);

        expect(screen.getByRole("heading", { level: 1, name: "Invinite Data API, live" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "API" }));

        expect(useRequestPanelStore.getState().open).toBe(true);
    });

    it("a failed list says so instead of \"nothing ahead\"; the other lists still render", () => {
        render(<LandingView {...data} holiday={{ data: null, failed: true, isLoading: false }} ipos={{ data: [], failed: true, isLoading: false }} />);

        expect(screen.getAllByText(/Could not load this list/)).toHaveLength(2);

        expect(screen.queryByText("No holiday announced ahead.")).toBeNull();

        expect(screen.queryByText("No IPO with a listing date ahead.")).toBeNull();

        expect(within(screen.getByTestId("landing-live")).getByText("MLCO")).toBeInTheDocument();
    });

    it("a failed calendar request fails the two earnings columns only", () => {
        render(<LandingView {...data} week={{ data: [], failed: true, isLoading: false }} />);

        expect(within(screen.getByTestId("landing-today-column")).getByText(/Could not load this list/)).toBeInTheDocument();

        expect(within(screen.getByTestId("landing-week-column")).getByText(/Could not load this list/)).toBeInTheDocument();

        expect(within(screen.getByTestId("landing-live-column")).queryByText(/Could not load/)).toBeNull();
    });

    it("live calls, today's and the week's earnings, next IPOs and the next holiday from the answers", () => {
        render(<LandingView {...data} />);

        expect(within(screen.getByTestId("landing-live")).getByText("MLCO")).toBeInTheDocument();

        const todayColumn = screen.getByTestId("landing-today-column");

        expect(within(todayColumn).getByText("MLCO")).toBeInTheDocument();

        expect(within(todayColumn).queryByText("LATER")).toBeNull();

        expect(within(screen.getByTestId("landing-week-column")).getByText("LATER")).toBeInTheDocument();

        expect(within(screen.getByTestId("landing-ipos")).getByRole("link", { name: "NEWCO" })).toHaveAttribute("href", "/NEWCO");

        expect(within(screen.getByTestId("landing-holiday")).getByText("Thanksgiving Day")).toBeInTheDocument();
    });

    it("empty lists say so in one line", () => {
        render(<LandingView {...data} ipos={{ data: [], isLoading: false }} live={{ ...data.live, data: [] }} week={{ data: [], isLoading: false }} />);

        expect(screen.getByText("No call is live right now.")).toBeInTheDocument();

        expect(screen.getByText("No earnings call today.")).toBeInTheDocument();

        expect(screen.getByText("No more calls this week.")).toBeInTheDocument();

        expect(screen.getByText("No IPO with a listing date ahead.")).toBeInTheDocument();
    });

    it("what the API covers: one row per family, linking its page, the count from the operations table", () => {
        render(<LandingView {...data} />);

        const rows = within(screen.getByTestId("api-families")).getAllByRole("link");

        expect(rows).toHaveLength(API_FAMILIES.length);

        expect(rows.map(row => row.getAttribute("href"))).toEqual([
            "/live-calls",
            "/filings",
            "/AAPL/financials",
            "/institutions",
            "/funds",
            "/news-feed",
            "/ipo-calendar",
            "/us-macro/inflation",
            "/alerts",
            "/catalog",
        ]);

        const counts = within(screen.getByTestId("api-families")).getAllByTestId("family-count").map(count => count.textContent);

        expect(counts).toEqual(API_FAMILIES.map(family => `${API_FAMILY_OPERATIONS[family.id].length} operations`));
    });

    it("recently opened: instruments and institutions", () => {
        render(<LandingView {...data} />);

        const recents = within(screen.getByTestId("landing-recents")).getAllByRole("link").map(link => link.getAttribute("href"));

        expect(recents).toEqual(["/AAPL", "/sec/102909"]);
    });

    it("loading lists show skeleton rows, not text", () => {
        render(<LandingView {...data} live={{ ...data.live, data: [], isLoading: true }} week={{ data: [], isLoading: true }} />);

        expect(screen.queryByText("No call is live right now.")).toBeNull();

        expect(screen.queryByText("No earnings call today.")).toBeNull();
    });
});
