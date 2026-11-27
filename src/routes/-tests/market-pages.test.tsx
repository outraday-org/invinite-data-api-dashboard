// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2Event } from "@/lib/api/types";

import { financialViewsFor } from "@/components/financials-pages/views";
import { CALENDAR_EVENT, CALENDAR_EVENT_EXPIRED_CALL } from "@/lib/earnings/calendar-fixtures";
import { AAPL_INSTRUMENT, SPY_INSTRUMENT } from "@/lib/instruments-fixtures";
import { V2_IPOS } from "@/lib/sec/v2-fixtures";
import { CalendarFilters } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";
import { CalendarWeekStrip } from "@/routes/$ticker/earnings-calls/-components/calendar-week-strip";
import { CalendarView } from "@/routes/calendar";
import { IpoDetail, ipoListedTicker, ipoRequest, ipoRowTarget, IposView, undatedPages, upcomingUndatedRequests } from "@/routes/ipo-calendar";
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

const view = { capped: false, error: null, filtering: false, hasNextPage: false, isFetchingNextPage: false, isLoading: false, now: new Date("2026-11-04T15:00:00Z"), onLoadMore: () => undefined, timeZone: "America/New_York" };

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

    it("days follow the viewer's zone: a 7 PM New York call sits on the next day in Berlin", () => {
        const evening: V2Event = { ...CALENDAR_EVENT, event_id: "evening", scheduled_at: "2026-11-05T00:00:00.000Z", symbol: "EVENING" };

        render(<CalendarView {...view} events={[CALENDAR_EVENT, evening]} timeZone="Europe/Berlin" />);

        expect(screen.getAllByTestId("data-table-group").map(row => row.textContent)).toEqual(["Wed, Nov 41 call", "Thu, Nov 51 call"]);
    });

    it("a client-side filter that found nothing in ten pages says so; while it still looks, no empty line", () => {
        const { rerender } = render(<CalendarView {...view} events={[]} filtering hasNextPage />);

        expect(screen.queryByText("No calls in this window.")).toBeNull();

        expect(screen.getAllByTestId("data-table-skeleton").length).toBeGreaterThan(0);

        rerender(<CalendarView {...view} capped events={[]} filtering hasNextPage />);

        expect(screen.getByText(/No call in the pages loaded so far matches/)).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });

    it("a click anywhere on a row opens its call; a click on a link inside it is left to the link", () => {
        const onOpenEvent = vi.fn();

        render(<CalendarView {...view} events={[CALENDAR_EVENT]} onOpenEvent={onOpenEvent} />);

        fireEvent.click(screen.getByText(CALENDAR_EVENT.company_name));

        expect(onOpenEvent).toHaveBeenCalledWith(CALENDAR_EVENT, false);

        fireEvent.click(screen.getByRole("link", { name: CALENDAR_EVENT.symbol }));

        expect(onOpenEvent).toHaveBeenCalledTimes(1);
    });

    it("every call status has its own colour; Published is green", () => {
        const published: V2Event = { ...CALENDAR_EVENT, capture_status: "published", event_id: "pub", symbol: "PUB" };

        const estimated: V2Event = { ...CALENDAR_EVENT, capture_status: "scheduled", date_status: "estimated", event_id: "est", symbol: "EST" };

        render(<CalendarView {...view} events={[published, estimated]} />);

        expect(screen.getByText("Published").className).toMatch(/emerald/);

        expect(screen.getByText("Estimated").className).toMatch(/amber/);
    });
});

describe("/calendar week strip and filters", () => {
    it("one card per weekday with its count; a card picks its day, previous / next only move the strip", () => {
        const onSelectDay = vi.fn();

        const onShowWeek = vi.fn();

        render(<CalendarWeekStrip counts={new Map([["2026-11-25", 82]])} countsPartial={false} day="2026-11-25" onSelectDay={onSelectDay} onShowWeek={onShowWeek} today="2026-11-25" weekOf="2026-11-25" />);

        const strip = screen.getByTestId("calendar-week-strip");

        expect(within(strip).getByText("Week 48")).toBeInTheDocument();

        // Monday … Friday; the weekend has no call.
        expect(within(strip).getAllByRole("button").filter(card => card.hasAttribute("aria-pressed"))).toHaveLength(5);

        expect(screen.getByRole("button", { name: "Wed Nov 25, today: 82 calls", pressed: true })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /^Mon Nov 23/ }));

        expect(onSelectDay).toHaveBeenLastCalledWith("2026-11-23");

        fireEvent.click(screen.getByRole("button", { name: "Next week" }));

        expect(onShowWeek).toHaveBeenLastCalledWith("2026-11-30");

        fireEvent.click(screen.getByRole("button", { name: "Previous week" }));

        expect(onShowWeek).toHaveBeenLastCalledWith("2026-11-16");

        expect(onSelectDay).toHaveBeenCalledTimes(1);
    });

    it("another week shows no selected card; Today comes back", () => {
        const onSelectDay = vi.fn();

        render(<CalendarWeekStrip counts={new Map()} countsPartial={false} day="2026-11-25" onSelectDay={onSelectDay} onShowWeek={() => undefined} today="2026-11-25" weekOf="2026-11-30" />);

        expect(screen.getByText("Week 49")).toBeInTheDocument();

        expect(screen.queryByRole("button", { pressed: true })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Today" }));

        expect(onSelectDay).toHaveBeenCalledWith("2026-11-25");
    });

    it("rare filters and the custom day range wait behind \"More filters\"", () => {
        render(<CalendarFilters onChange={() => undefined} search={{}} />);

        expect(screen.queryByText("Fiscal year")).toBeNull();

        expect(screen.queryByLabelText("From")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "More filters" }));

        expect(screen.getByText("Fiscal year")).toBeInTheDocument();

        expect(screen.getByLabelText("From")).toBeInTheDocument();

        expect(screen.getByText("Companies")).toBeInTheDocument();
    });

    it("a set rare filter opens \"More filters\" and counts on Reset", () => {
        render(<CalendarFilters onChange={() => undefined} search={{ fiscalYear: 2026, from: "2026-11-01" }} />);

        expect(screen.getByText("Fiscal year")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Fewer filters" })).toBeInTheDocument();
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
    it("Upcoming = not trading / withdrawn / dormant, by listing date ascending; Recent = listed up to today, newest first", () => {
        const upcoming = ipoRequest({}, "2026-11-21");

        expect(upcoming.sort).toBe("listing_date");

        expect(upcoming.stage).not.toContain("trading");

        expect(upcoming.stage).not.toContain("withdrawn");

        expect(upcoming.stage).not.toContain("dormant");

        expect(upcoming.listingDateLte).toBeUndefined();

        // F013: page 1 starts at the next listing (today, New York); the undated offerings follow from the tail.
        expect(upcoming.listingDateGte).toBe("2026-11-21");

        expect(upcomingUndatedRequests({ tab: "recent" }, "2026-11-21")).toEqual([]);

        expect(upcomingUndatedRequests({ from: "2026-12-01" }, "2026-11-21")).toEqual([]);

        expect(ipoRequest({ to: "2026-12-31" }, "2026-11-21").listingDateGte).toBeUndefined();

        expect(undatedPages([{ ...V2_IPOS, data: [{ ...V2_IPOS.data[0], listing_date: "2026-11-23" }, { ...V2_IPOS.data[0], listing_date: null }] }])[0].data).toHaveLength(1);

        expect(ipoRequest({ spac: "yes", tab: "recent" }, "2026-11-21")).toMatchObject({ isSpac: true, listingDateLte: "2026-11-21", sort: "-listing_date", stage: undefined });

        expect(ipoRequest({ stage: "priced" }, "2026-11-21").stage).toEqual(["priced"]);
    });

    it("Upcoming's undated tail: SEC registrations first (newest first_public_at), then the calendar announcements; dormant only by the Stage filter", () => {
        const [registrations, calendar] = upcomingUndatedRequests({}, "2026-11-21");

        expect(registrations).toMatchObject({ listingDateGte: undefined, sort: "-first_public_at", stage: ["registered", "price_range", "exchange_approved", "effective", "priced"] });

        expect(calendar).toMatchObject({ listingDateGte: undefined, sort: "listing_date", stage: ["announced", "postponed"] });

        expect(upcomingUndatedRequests({ stage: "priced" }, "2026-11-21")).toMatchObject([{ sort: "-first_public_at", stage: ["priced"] }]);

        expect(ipoRequest({ stage: "dormant" }, "2026-11-21").stage).toEqual(["dormant"]);

        expect(upcomingUndatedRequests({ stage: "dormant" }, "2026-11-21")).toMatchObject([{ sort: "listing_date", stage: ["dormant"] }]);
    });

    it("a dormant announcement reads \"Dormant\" in a grey badge", () => {
        render(<IposView error={null} hasNextPage={false} isFetchingNextPage={false} isLoading={false} onLoadMore={() => undefined} pages={[{ ...V2_IPOS, data: [{ ...V2_IPOS.data[0], stage: "dormant" }] }]} />);

        expect(screen.getByText("Dormant").closest("[data-slot=badge]")?.className).toContain("bg-secondary");
    });

    it("a row click hands the offering over; no Details column", () => {
        const onOpen = vi.fn();

        render(<IposView error={null} hasNextPage={false} isFetchingNextPage={false} isLoading={false} onLoadMore={() => undefined} onOpen={onOpen} pages={[V2_IPOS]} />);

        expect(screen.queryByRole("button", { name: "Details" })).toBeNull();

        fireEvent.click(screen.getAllByRole("row")[1]);

        expect(onOpen).toHaveBeenCalledWith(V2_IPOS.data[0], false);
    });

    it("a row goes to the listed company, else the issuer's filer page, else the detail; a proposed ticker is no link", () => {
        const base = V2_IPOS.data[0];

        const listing = { ...base.sources.listing, ticker: "NEWCO" } as NonNullable<typeof base.sources.listing>;

        expect(ipoRowTarget({ ...base, company: { cik: "0002156369", ticker: "NEWCO" } })).toEqual({ kind: "ticker", ticker: "NEWCO" });

        expect(ipoRowTarget({ ...base, company: null, sources: { listing, registration: null }, stage: "trading" })).toEqual({ kind: "ticker", ticker: "NEWCO" });

        // Before trading the calendar's ticker is only proposed: no instrument page yet.
        expect(ipoListedTicker({ ...base, company: null, sources: { listing, registration: null }, stage: "announced" })).toBeNull();

        expect(ipoRowTarget({ ...base, company: { cik: "0002156369", ticker: null }, stage: "registered" })).toEqual({ cik: "2156369", kind: "filer" });

        expect(ipoRowTarget({ ...base, company: null, sources: { listing, registration: null }, stage: "announced" })).toEqual({ kind: "detail" });
    });

    it("the detail lists the stage timestamps and pricing", () => {
        render(<IpoDetail ipo={V2_IPOS.data[0]} />);

        const detail = screen.getByTestId("ipo-detail");

        expect(within(detail).getByText("Price range set")).toBeInTheDocument();

        expect(within(detail).getByText("$16.00 – $18.00")).toBeInTheDocument();

        expect(within(detail).queryByText("Priced")).toBeNull();

        // The issuer opens its SEC filer page; a not-yet-listed offering names its proposed symbol.
        expect(within(detail).getByText("Rezera Inc").closest("a")).toHaveAttribute("href", "/sec/2156369");

        expect(within(detail).getByText("RZRA (proposed)")).toBeInTheDocument();
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
