// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { V2Instrument } from "@/lib/api/types";

import { CALENDAR_EVENT } from "@/lib/earnings/calendar-fixtures";
import { AAPL_INSTRUMENT, ACA_INSTRUMENT } from "@/lib/instruments-fixtures";
import { Route } from "@/routes/$ticker/earnings-calls/index";

const state = vi.hoisted(() => ({ instrument: null as null | V2Instrument, navigate: vi.fn(), ticker: "ACA" }));

// Its historical printed ticker differs from the scoped instrument's URL, as after a ticker reuse/change.
const event = { ...CALENDAR_EVENT, scheduled_at: "2020-08-05T12:00:00Z", symbol: "REUSED" };

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({
        options,
        useNavigate: () => state.navigate,
        useParams: () => ({ ticker: state.ticker }),
        useSearch: () => ({}),
    }),
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

vi.mock("@/lib/api/queries", () => ({
    useInstrument: () => ({ data: state.instrument }),
    useV2EventsInfinite: () => ({ data: { pages: [{ data: [event] }] } }),
}));

vi.mock("@/components/alerts/create-alert-button", () => ({ AlertEntryPoints: () => null, ENTRY_TYPES: { calls: [] } }));

vi.mock("@/components/api/export-menu", () => ({ ExportMenu: () => null }));

vi.mock("@/routes/$ticker/documents/-components/document-search", () => ({ DocumentSearch: () => null }));

vi.mock("@/routes/$ticker/earnings-calls/-components/ask-this-call", () => ({ AskThisCall: () => null }));

vi.mock("@/routes/$ticker/earnings-calls/-components/live-now-strip", () => ({ LiveNowStrip: () => <div data-testid="live-strip">Live events</div> }));

const Page = Route.options.component as React.ComponentType;

const url = (ticker: string) => `/${ticker}/earnings-calls/${event.event_id}`;

const callRow = () => screen.getByRole("link", { name: "Open" }).closest("tr")!;

beforeEach(() => {
    state.instrument = ACA_INSTRUMENT;

    state.ticker = "ACA";

    state.navigate.mockClear();
});

afterEach(() => {
    cleanup();

    vi.restoreAllMocks();
});

it("historical links and normal row opening retain the page ticker despite a differing event symbol", () => {
    render(<Page />);

    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(2);

    for (const link of links) expect(link).toHaveAttribute("href", url("ACA"));

    fireEvent.click(callRow());

    expect(state.navigate).toHaveBeenCalledWith({ params: { eventId: event.event_id, ticker: "ACA" }, to: "/$ticker/earnings-calls/$eventId" });

    expect(screen.queryByTestId("live-strip")).toBeNull();

    expect(event.symbol).toBe("REUSED");
});

it("historical meta/control row opening retains the page ticker in a new tab", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    render(<Page />);

    for (const modifier of [{ metaKey: true }, { ctrlKey: true }]) {
        fireEvent.click(callRow(), modifier);

        expect(open).toHaveBeenLastCalledWith(url("ACA"), "_blank", "noopener");
    }

    expect(state.navigate).not.toHaveBeenCalled();
});

it("listed links and row handlers keep the event's own symbol and its live strip", () => {
    state.instrument = AAPL_INSTRUMENT;

    state.ticker = "AAPL";

    const open = vi.spyOn(window, "open").mockReturnValue(null);

    render(<Page />);

    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", url("REUSED"));

    fireEvent.click(callRow());

    expect(state.navigate).toHaveBeenCalledWith({ params: { eventId: event.event_id, ticker: "REUSED" }, to: "/$ticker/earnings-calls/$eventId" });

    fireEvent.click(callRow(), { metaKey: true });

    expect(open).toHaveBeenCalledWith(url("REUSED"), "_blank", "noopener");

    expect(screen.getByTestId("live-strip")).toBeInTheDocument();
});
