// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AlertsListState } from "@/components/alerts/alerts-list-view";

import { BatchResultsView } from "@/components/alerts/alert-parts";
import { AlertsListView } from "@/components/alerts/alerts-list-view";
import { batchChunks, confirmWords } from "@/components/alerts/use-alert-actions";
import { affectedText, ConfirmAction } from "@/components/ui/confirm-action";
import { ALERT_FILING, ALERT_INDICATOR, ALERT_PRICE, ALERTS_PAGE_FIXTURE, BATCH_PARTIAL } from "@/lib/alerts/alerts-fixtures";
import { ApiRequestError } from "@/lib/api/errors";
import { useAlertsInfinite } from "@/lib/api/queries";
import { alertsRequest, Route } from "@/routes/alerts/index";

const search = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options, useNavigate: () => vi.fn(), useSearch: () => search.value }),
    Link: ({ children, params, to }: { children: React.ReactNode; params?: Record<string, string>; to: string }) => (
        <a href={Object.entries(params ?? {}).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
    useNavigate: () => vi.fn(),
}));

vi.mock("@/lib/api/queries", () => ({ ALERT_QUERY_KEYS: { alert: [], event: [], events: [], list: [], templates: [] }, ALERT_USER_QUERY_KEYS: { defaults: [], users: [] }, useAlertsInfinite: vi.fn() }));

vi.mock("@/lib/api/mutations", () => ({ useApiMutation: () => ({ isPending: false, mutateAsync: vi.fn() }) }));

afterEach(cleanup);

const state = (patch: Partial<AlertsListState> = {}): AlertsListState => ({
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    onLoadMore: vi.fn(),
    pages: [ALERTS_PAGE_FIXTURE],
    ...patch,
});

const selection = (patch: Partial<Parameters<typeof AlertsListView>[0]["selection"]> = {}) => ({
    busy: new Set<string>(),
    onAction: vi.fn(),
    onSelect: vi.fn(),
    selected: new Set<string>(),
    ...patch,
});

describe("/alerts list (`GET /v1/alerts`)", () => {
    it("one row per alert: type linking its page, what it watches, status, destinations, end user, fires, last fired; quota line", () => {
        render(<AlertsListView selection={selection()} state={state()} />);

        const filing = screen.getByRole("link", { name: "SEC filing" });

        expect(filing).toHaveAttribute("href", `/alerts/${ALERT_FILING.id}`);

        const row = filing.closest("tr")!;

        expect(within(row).getByText("AAPL")).toBeInTheDocument();

        expect(within(row).getByText("watchlist-aapl-8k")).toBeInTheDocument();

        expect(within(row).getByText(ALERT_FILING.destination_ids[0])).toBeInTheDocument();

        expect(within(row).getByText("user_8812")).toBeInTheDocument();

        expect(within(row).getByText("3")).toBeInTheDocument();

        expect(screen.getByText("AAPL, MSFT, NVDA +1")).toBeInTheDocument();

        expect(screen.getByTestId("alerts-quota")).toHaveTextContent("6 of 100 alerts in use · 1 of 10 script / indicator alerts · fire cap 1,000 a day (UTC)");
    });

    it("a disabled alert names its reason on the status badge", () => {
        render(<AlertsListView selection={selection()} state={state()} />);

        expect(screen.getByLabelText("Status Disabled: Its script aborted on 3 bars in a row.")).toBeInTheDocument();
    });

    it("selection → the bulk bar hands the picked alerts to the action (confirmed by the page)", () => {
        const onAction = vi.fn();

        render(<AlertsListView selection={selection({ onAction, selected: new Set([ALERT_FILING.id, ALERT_PRICE.id]) })} state={state()} />);

        const bar = screen.getByTestId("bulk-bar");

        expect(within(bar).getByText("2 selected")).toBeInTheDocument();

        fireEvent.click(within(bar).getByRole("button", { name: "Delete…" }));

        expect(onAction).toHaveBeenCalledWith("delete", [ALERT_FILING, ALERT_PRICE]);
    });

    it("a 503 is the switched-off notice, never an empty list", () => {
        const error = new ApiRequestError(503, { error: "unavailable", message: "The alerts platform is switched off" });

        render(<AlertsListView selection={selection()} state={state({ error, pages: [] })} />);

        expect(screen.getByText("Alerts are switched off on the API right now")).toBeInTheDocument();
    });

    it("an end user's page: no account quota line, an empty text without filters (F117)", () => {
        render(<AlertsListView scope="end-user" selection={selection()} state={state({ pages: [{ ...ALERTS_PAGE_FIXTURE, data: [], has_more: false, next_cursor: null }] })} />);

        expect(screen.queryByTestId("alerts-quota")).not.toBeInTheDocument();

        expect(screen.getByText("This end user has no alerts.")).toBeInTheDocument();

        expect(screen.queryByText("No alert matches these filters.")).not.toBeInTheDocument();
    });

    it("the account list: an empty text by whether a filter is set (F118)", () => {
        const empty = state({ pages: [{ ...ALERTS_PAGE_FIXTURE, data: [], has_more: false, next_cursor: null }] });

        const { rerender } = render(<AlertsListView selection={selection()} state={empty} />);

        expect(screen.getByText("No alert yet: create one with New alert.")).toBeInTheDocument();

        rerender(<AlertsListView filtered selection={selection()} state={empty} />);

        expect(screen.getByText("No alert matches these filters.")).toBeInTheDocument();
    });

    it("bulk results: per item, a partial failure visible with its reason", () => {
        render(<BatchResultsView ids={[ALERT_FILING.id, "alt_gone", ALERT_PRICE.id]} onDismiss={vi.fn()} results={BATCH_PARTIAL.results} />);

        const box = screen.getByTestId("batch-results");

        expect(box).toHaveTextContent("2 of 3 done · 1 refused");

        expect(within(box).getByText(/Refused: not_found — No alert alt_gone on this account\./)).toBeInTheDocument();
    });
});

describe("filters: every one goes to the API and lives in the URL", () => {
    it("?symbol= and ?destination_id= (Data API 7.1) reach the request with the 7.0 filters", () => {
        expect(alertsRequest({ destination_id: "dst_1", external_user_id: "u1", status: "paused", symbol: "AAPL", type: "price" })).toEqual({
            clientReferenceId: undefined,
            destinationId: "dst_1",
            externalUserId: "u1",
            status: "paused",
            symbol: "AAPL",
            type: "price",
        });

        const schema = Route.options.validateSearch as { parse: (value: unknown) => unknown };

        expect(schema.parse({ destination_id: "dst_1", status: "bogus", symbol: "AAPL" })).toEqual({ destination_id: "dst_1", symbol: "AAPL" });
    });

    it("the page asks the list with the URL's filters", () => {
        search.value = { symbol: "AAPL" };

        vi.mocked(useAlertsInfinite).mockReturnValue({ data: { pages: [ALERTS_PAGE_FIXTURE] }, error: null, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false, isLoading: false } as never);

        const Page = Route.options.component as React.ComponentType;

        render(<Page />);

        expect(useAlertsInfinite).toHaveBeenLastCalledWith(expect.objectContaining({ destinationId: undefined, symbol: "AAPL" }));

        expect(screen.getByRole("heading", { name: "Alerts" })).toBeInTheDocument();

        search.value = {};
    });
});

describe("confirmations state the effect", () => {
    it("delete, bulk changes and the test event ask first; a single pause / resume does not", () => {
        expect(confirmWords("delete", [ALERT_FILING])?.effect).toContain("cannot be undone");

        expect(confirmWords("pause", [ALERT_FILING, ALERT_PRICE])?.title).toBe("Pause 2 alerts?");

        expect(confirmWords("resume", [ALERT_FILING, ALERT_PRICE])?.effect).toContain("armed again");

        expect(confirmWords("test", [ALERT_FILING])?.effect).toContain("DELIVERS it to the alert's 1 destination");

        expect(confirmWords("test", [ALERT_INDICATOR])?.effect).toContain("no destination");

        expect(confirmWords("pause", [ALERT_FILING])).toBeNull();

        expect(confirmWords("resume", [ALERT_FILING])).toBeNull();
    });

    it("ConfirmAction shows title, effect, the ids and the confirm verb; confirm runs the action", () => {
        const onConfirm = vi.fn();

        render(<ConfirmAction confirmLabel="Delete 2 alerts" destructive effect="They stop firing." ids={["alt_1", "alt_2"]} onConfirm={onConfirm} onOpenChange={vi.fn()} open title="Delete 2 alerts?" />);

        expect(screen.getByText("Delete 2 alerts?")).toBeInTheDocument();

        expect(screen.getByText("They stop firing.")).toBeInTheDocument();

        expect(screen.getByTestId("confirm-ids")).toHaveTextContent("2 alerts: alt_1, alt_2");

        fireEvent.click(screen.getByRole("button", { name: "Delete 2 alerts" }));

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("long id lists are counted; bulk requests split at 500 items", () => {
        expect(affectedText(Array.from({ length: 10 }, (_, index) => `a${index}`))).toBe("a0, a1, a2, a3, a4, a5, a6, a7 and 2 more");

        expect(batchChunks(Array.from({ length: 1001 }, (_, index) => index)).map(chunk => chunk.length)).toEqual([500, 500, 1]);
    });
});
