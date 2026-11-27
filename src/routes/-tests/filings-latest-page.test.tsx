// @vitest-environment jsdom
import type * as React from "react";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { ReceivedFiling } from "@/lib/live/live-filings";

import { ApiRequestError } from "@/lib/api/errors";
import { LIVE_FILING, LIVE_FILING_S1 } from "@/lib/sec/filing-detail-fixtures";
import { V2_FILINGS, V2_LATEST_FILINGS } from "@/lib/sec/v2-fixtures";
import { Route } from "@/routes/filings/index";

const state = vi.hoisted(() => ({
    live: [] as Array<ReceivedFiling>,
    navigate: vi.fn(),
    query: vi.fn(),
    reconnect: () => {},
    refetch: vi.fn(),
    search: {} as Record<string, unknown>,
}));

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options, useNavigate: () => state.navigate, useSearch: () => state.search }),
    Link: ({ children, params = {}, to }: { children: React.ReactNode; params?: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

vi.mock("@/lib/api/queries", () => ({ useLatestFilingsPage: (args: unknown) => state.query(args) }));

vi.mock("@/lib/live/live-default", async importOriginal => ({ ...await importOriginal<object>(), useLiveDefault: () => true }));

vi.mock("@/routes/$ticker/filings/-components/use-live-filings-feed", () => ({
    useLiveFilingsFeed: ({ onReconnected }: { onReconnected: () => void }) => {
        state.reconnect = onReconnected;

        return { clearStop: vi.fn(), filings: state.live, mode: "live", stop: null };
    },
}));

vi.mock("@/components/sec/sec-filing-search", () => ({ SecFilingSearch: () => null }));

vi.mock("@/components/sec/sec-source-panel", () => ({ SecSourceDialog: () => null }));

vi.mock("@/components/api/export-menu", () => ({ ExportMenu: () => null }));

const Page = Route.options.component as React.ComponentType;

const answer = (patch = {}) => ({ data: V2_LATEST_FILINGS, error: null, isFetching: false, isLoading: false, refetch: state.refetch, ...patch });

const row = (id: string) => screen.getByRole("link", { name: id }).closest("tr");

beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-11-27T10:00:00Z"));

    state.live = [];

    state.search = {};

    state.query.mockReset().mockReturnValue(answer());

    state.refetch.mockReset();

    state.navigate.mockReset().mockImplementation(({ search }) => {
        state.search = search(state.search);
    });
});

afterEach(() => {
    cleanup();

    vi.useRealTimers();
});

it("renders REST rows in API order and retains them without skeletons during refresh", () => {
    state.query.mockReturnValue(answer({ isFetching: true }));

    render(<Page />);

    V2_LATEST_FILINGS.data.forEach((filing, index) => expect(screen.getAllByRole("row")[index + 1]).toHaveTextContent(filing.accession));

    expect(screen.getByText(V2_LATEST_FILINGS.data[0].filer?.name ?? "")).toBeInTheDocument();

    expect(screen.queryAllByTestId("data-table-skeleton")).toHaveLength(0);
});

it("shows skeletons below early live rows, which never flash when REST settles; later frames flash once", () => {
    state.query.mockReturnValue(answer({ data: null, isLoading: true }));

    state.live = [{ filing: LIVE_FILING, receivedAt: new Date().toISOString() }];

    const { rerender } = render(<Page />);

    expect(screen.getAllByTestId("data-table-skeleton")).toHaveLength(5);

    expect(screen.getAllByRole("row")[1]).toHaveTextContent(LIVE_FILING.accession_number);

    state.query.mockReturnValue(answer());

    rerender(<Page />);

    expect(row(LIVE_FILING.accession_number)).not.toHaveClass("row-arrive");

    state.live = [...state.live, { filing: LIVE_FILING_S1, receivedAt: new Date().toISOString() }];

    rerender(<Page />);

    expect(row(LIVE_FILING_S1.accession_number)).toHaveClass("row-arrive");

    act(() => vi.advanceTimersByTime(2500));

    expect(row(LIVE_FILING_S1.accession_number)).not.toHaveClass("row-arrive");
});

it("live=false keeps the list and suppresses flashes", () => {
    state.search = { live: false };

    state.live = [{ filing: LIVE_FILING, receivedAt: new Date().toISOString() }];

    render(<Page />);

    expect(row(LIVE_FILING.accession_number)).not.toHaveClass("row-arrive");

    expect(row(V2_FILINGS.data[0].accession)).toBeInTheDocument();
});

it("refetches on page-one reconnect only, pages by cursor without live rows and resets on a form change", () => {
    state.query.mockImplementation(({ cursor }) => answer({ data: cursor ? V2_FILINGS : { ...V2_LATEST_FILINGS, next_cursor: "page-two" } }));

    state.live = [{ filing: LIVE_FILING_S1, receivedAt: new Date().toISOString() }];

    const { rerender } = render(<Page />);

    act(() => state.reconnect());

    expect(state.refetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Next"));

    expect(state.query).toHaveBeenLastCalledWith({ cursor: "page-two", form: [] });

    expect(screen.queryByRole("link", { name: LIVE_FILING_S1.accession_number })).toBeNull();

    act(() => state.reconnect());

    expect(state.refetch).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Latest filings by form"), { target: { value: "8-K,S-1" } });

    act(() => vi.advanceTimersByTime(1000));

    rerender(<Page />);

    expect(state.query).toHaveBeenLastCalledWith({ cursor: null, form: ["8-K", "S-1"] });
});

it("sends URL forms to REST and filters live frames in the browser", () => {
    state.search = { form: "8-K,S-1" };

    state.live = [
        { filing: LIVE_FILING_S1, receivedAt: new Date().toISOString() },
        { filing: { ...LIVE_FILING, form_type: "10-K" }, receivedAt: new Date().toISOString() },
    ];

    render(<Page />);

    expect(state.query).toHaveBeenLastCalledWith({ cursor: null, form: ["8-K", "S-1"] });

    expect(screen.getByText(/Live: showing 1 of 2/)).toBeInTheDocument();
});

it("keeps live rows beneath a REST failure notice", () => {
    state.query.mockReturnValue(answer({ data: null, error: new ApiRequestError(503, { error: "unavailable", message: "Door unavailable", requestId: "test" }) }));

    state.live = [{ filing: LIVE_FILING, receivedAt: new Date().toISOString() }];

    render(<Page />);

    expect(screen.getByText("Door unavailable")).toBeInTheDocument();

    expect(row(LIVE_FILING.accession_number)).toBeInTheDocument();
});
