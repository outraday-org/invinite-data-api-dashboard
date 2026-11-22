// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2Event } from "@/lib/api/types";

import { financialViewsFor } from "@/components/financials-pages/views";
import { CALENDAR_EVENT, CALENDAR_EVENT_EXPIRED_CALL } from "@/lib/earnings/calendar-fixtures";
import { AAPL_INSTRUMENT, SPY_INSTRUMENT } from "@/lib/instruments-fixtures";
import { V2_IPOS } from "@/lib/sec/v2-fixtures";
import { CalendarView } from "@/routes/calendar";
import { IpoDetail, ipoRequest, IposView } from "@/routes/ipo-calendar";
import { LiveCallsView, nextCallsOf } from "@/routes/live-calls";
import { holidayStatus, MarketHolidaysView } from "@/routes/market-holidays";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, params = {}, to }: { children: React.ReactNode; params?: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

// Keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({}));

vi.mock("@/routes/$ticker/earnings-calls/-components/live-now-strip", () => ({ LiveNowStrip: () => null }));

afterEach(cleanup);

const view = { capped: false, error: null, filtering: false, hasNextPage: false, isFetchingNextPage: false, isLoading: false, now: new Date("2026-11-04T15:00:00Z"), onLoadMore: () => undefined };

describe("/calendar (`/v1/events`, grouped by New York day)", () => {
    it("one heading per New York day with its count; rows under their day", () => {
        const second: V2Event = { ...CALENDAR_EVENT, event_id: "second", scheduled_at: "2026-11-04T21:00:00.000Z", symbol: "SECOND" };

        render(<CalendarView {...view} events={[CALENDAR_EVENT, second, CALENDAR_EVENT_EXPIRED_CALL]} />);

        const headings = screen.getAllByTestId("data-table-group").map(row => row.textContent);

        expect(headings[0]).toBe("Wed, Nov 42 calls");

        expect(headings).toHaveLength(2);
    });

    it("a date-only event (UTC midnight = the evening before in New York) does not split the previous day's group", () => {
        const dateOnly: V2Event = { ...CALENDAR_EVENT, call_time_source: null, event_id: "date-only", scheduled_at: "2026-11-05T00:00:00.000Z", symbol: "DATEONLY" };

        const late: V2Event = { ...CALENDAR_EVENT, event_id: "late", scheduled_at: "2026-11-05T01:00:00.000Z", symbol: "LATE" };

        // The API's `scheduled_at` order: Nov 4 call, Nov 5 date-only (00:00Z), Nov 4 20:00 New York call (01:00Z).
        render(<CalendarView {...view} events={[CALENDAR_EVENT, dateOnly, late]} />);

        const headings = screen.getAllByTestId("data-table-group").map(row => row.textContent);

        expect(headings).toEqual(["Wed, Nov 42 calls", "Thu, Nov 51 call"]);
    });

    it("a client-side filter that found nothing in ten pages says so; while it still looks, no empty line", () => {
        const { rerender } = render(<CalendarView {...view} events={[]} filtering hasNextPage />);

        expect(screen.queryByText("No calls in this window.")).toBeNull();

        expect(screen.getAllByTestId("data-table-skeleton").length).toBeGreaterThan(0);

        rerender(<CalendarView {...view} capped events={[]} filtering hasNextPage />);

        expect(screen.getByText(/No call in the pages loaded so far matches/)).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });
});

describe("/live-calls", () => {
    it("a failed next-calls request is an error, not \"nothing scheduled\"", () => {
        render(<LiveCallsView asOf={new Date("2026-11-04T13:50:00Z")} error={null} isLoading={false} live={[]} next={[]} nextError={new Error("Network down")} nextLoading={false} />);

        expect(screen.getByText("Failed to load the next calls")).toBeInTheDocument();

        expect(screen.queryByText("No call is scheduled in the next days.")).toBeNull();
    });

    it("one card per live call, linking its call page", () => {
        render(<LiveCallsView asOf={new Date("2026-11-04T13:50:00Z")} error={null} isLoading={false} live={[CALENDAR_EVENT]} next={[]} nextLoading={false} />);

        const card = screen.getByTestId("live-call-card");

        expect(within(card).getByText("MLCO")).toBeInTheDocument();

        expect(within(card).getByText("started 15 min ago")).toBeInTheDocument();

        expect(card.closest("a")).toHaveAttribute("href", `/MLCO/earnings-calls/${CALENDAR_EVENT.event_id}`);
    });

    it("none live: says so and names the next scheduled calls", () => {
        render(<LiveCallsView asOf={new Date()} error={null} isLoading={false} live={[]} next={[CALENDAR_EVENT_EXPIRED_CALL]} nextLoading={false} />);

        expect(screen.getByText("No call is live right now.")).toBeInTheDocument();

        expect(within(screen.getByTestId("next-calls")).getByText(CALENDAR_EVENT_EXPIRED_CALL.symbol)).toBeInTheDocument();
    });

    it("the next calls are in New York day order: tonight's timed call before tomorrow's date-only event", () => {
        // API order (`scheduled_at`): the date-only Nov 23 event's UTC midnight comes before 19:30 ET on Nov 22.
        const dateOnly = { call_time_source: null, scheduled_at: "2026-11-23T00:00:00.000Z", symbol: "AYA" } as const;

        const tonight = { call_time_source: "edgar", scheduled_at: "2026-11-23T00:30:00.000Z", symbol: "TUYA" } as const;

        expect(nextCallsOf([dateOnly, tonight]).map(event => event.symbol)).toEqual(["TUYA", "AYA"]);

        expect(nextCallsOf(Array.from({ length: 10 }, () => tonight))).toHaveLength(6);
    });
});

describe("/ipo-calendar (`/v1/ipos`, `/v1/ipos/{ipo_id}`)", () => {
    it("Upcoming = not trading / withdrawn, by listing date ascending; Recent = listed up to today, newest first", () => {
        const upcoming = ipoRequest({}, "2026-11-21");

        expect(upcoming.sort).toBe("listing_date");

        expect(upcoming.stage).not.toContain("trading");

        expect(upcoming.listingDateLte).toBeUndefined();

        expect(ipoRequest({ spac: "yes", tab: "recent" }, "2026-11-21")).toMatchObject({ isSpac: true, listingDateLte: "2026-11-21", sort: "-listing_date", stage: undefined });

        expect(ipoRequest({ stage: "priced" }, "2026-11-21").stage).toEqual(["priced"]);
    });

    it("a listed symbol opens its page; Details opens the offering", () => {
        const onOpen = vi.fn();

        render(<IposView error={null} hasNextPage={false} isFetchingNextPage={false} isLoading={false} onLoadMore={() => undefined} onOpen={onOpen} pages={[V2_IPOS]} />);

        expect(screen.getByRole("link", { name: "NEWCO" })).toHaveAttribute("href", "/NEWCO");

        screen.getAllByRole("button", { name: "Details" })[0].click();

        expect(onOpen).toHaveBeenCalledWith(V2_IPOS.data[0]);
    });

    it("the detail lists the stage timestamps and pricing", () => {
        render(<IpoDetail ipo={V2_IPOS.data[0]} />);

        const detail = screen.getByTestId("ipo-detail");

        expect(within(detail).getByText("Price range set")).toBeInTheDocument();

        expect(within(detail).getByText("$16.00 – $18.00")).toBeInTheDocument();

        expect(within(detail).queryByText("Priced")).toBeNull();
    });
});

describe("/market-holidays", () => {
    it("status from the day's open / close", () => {
        expect(holidayStatus({ end_time: null, start_time: null })).toBe("Closed");

        expect(holidayStatus({ end_time: "2026-11-27T18:00:00Z", start_time: "2026-11-27T14:30:00Z" })).toBe("Early close");

        render(
            <MarketHolidaysView
                error={null}
                hasNextPage={false}
                isFetchingNextPage={false}
                isLoading={false}
                onLoadMore={() => undefined}
                pages={[{ data: [{ day: "2026-11-26", end_time: null, event_name: "Thanksgiving Day", start_time: null }], has_more: false, meta: {} as never, next_cursor: null }]}
            />,
        );

        expect(within(screen.getByText("Thanksgiving Day").closest("tr")!).getAllByText("Closed").length).toBeGreaterThan(0);
    });
});

describe("/$ticker/financials (one route, tabs by `datasets`)", () => {
    it("a stock has every tab; a fund none", () => {
        expect(financialViewsFor(AAPL_INSTRUMENT.datasets).map(tab => tab.value)).toEqual(["standardized", "as-reported", "ratios", "growth", "cagr", "segments"]);

        expect(financialViewsFor(SPY_INSTRUMENT.datasets)).toEqual([]);
    });
});
