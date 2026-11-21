// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AlertDetailView } from "@/components/alerts/alert-detail-view";
import { AlertEventsView, SingleEventView } from "@/components/alerts/alert-events-view";
import { eventsNewestFirst } from "@/lib/alerts/alert-view";
import { ALERT_DIVIDEND, ALERT_FILING, ALERT_INDICATOR, ALERT_PRICE, EVENT_TEST, EVENTS_PAGE_FIXTURE, fixtureEvent } from "@/lib/alerts/alerts-fixtures";
import { ApiRequestError } from "@/lib/api/errors";
import { LiveStatus } from "@/routes/alerts/events";
import { plansAlerts } from "@/routes/alerts/route";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, params, search, to }: { children: React.ReactNode; params?: Record<string, string>; search?: Record<string, string>; to: string }) => (
        <a href={`${Object.entries(params ?? {}).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}${search ? `?${new URLSearchParams(search).toString()}` : ""}`}>{children}</a>
    ),
    Outlet: () => null,
}));

afterEach(cleanup);

const listState = { error: null, hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: vi.fn() };

describe("/alerts/events (the feed)", () => {
    it("newest first; a live event is marked New; a row opens its payload", () => {
        const live = fixtureEvent("evt_09", { occurred_at: "2026-11-21T15:00:00Z" });

        render(<AlertEventsView events={eventsNewestFirst([EVENTS_PAGE_FIXTURE], [live])} liveIds={new Set(["evt_09"])} loadedNote="All 4 events, newest first." operationId="listAlertEvents" state={listState} />);

        const rows = within(screen.getByTestId("alert-events")).getAllByRole("listitem");

        expect(rows.map(row => row.getAttribute("data-event-id"))).toEqual(["evt_09", "evt_03", "evt_02", "evt_01"]);

        expect(within(rows[0]).getByText("New")).toBeInTheDocument();

        expect(within(rows[1]).getByText("Test")).toBeInTheDocument();

        expect(within(rows[2]).getByText("active → paused")).toBeInTheDocument();

        expect(within(rows[3]).getByRole("link", { name: ALERT_FILING.id })).toHaveAttribute("href", `/alerts/${ALERT_FILING.id}`);

        fireEvent.click(within(rows[3]).getByRole("button", { expanded: false }));

        expect(within(rows[3]).getByText(/Payload/)).toBeInTheDocument();

        expect(rows[3].querySelector("[data-slot=json-tree]")).not.toBeNull();

        expect(screen.getByText("All 4 events, newest first.")).toBeInTheDocument();
    });

    it("an opened event that is not in the log yet says so and can be asked again", () => {
        const onRetry = vi.fn();

        render(<SingleEventView error={new ApiRequestError(404, { error: "not_found", message: "No event evt_x" })} event={null} isLoading={false} onClose={vi.fn()} onRetry={onRetry} />);

        expect(screen.getByText(/not in the log yet/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Try again" }));

        expect(onRetry).toHaveBeenCalled();
    });

    it("an opened event shows its payload at once", () => {
        const { container } = render(<SingleEventView error={null} event={EVENT_TEST} isLoading={false} onClose={vi.fn()} onRetry={vi.fn()} />);

        expect(container.querySelector(`[data-event-id="${EVENT_TEST.id}"] [data-slot=json-tree]`)).not.toBeNull();
    });

    it("Live: mode, the skipped-events note with a reload, the stream's notes, ignored frames", () => {
        const onReload = vi.fn();

        render(<LiveStatus ignored={2} mode="retrying" note="after: no event evt_1" onReload={onReload} truncatedAt="evt_77" />);

        expect(screen.getByText("Reconnecting…")).toBeInTheDocument();

        expect(screen.getByText("Some events were skipped")).toBeInTheDocument();

        expect(screen.getByText("2 unknown frames ignored")).toBeInTheDocument();

        expect(screen.getByText("Stream note: after: no event evt_1")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Reload the list" }));

        expect(onReload).toHaveBeenCalled();
    });
});

describe("/alerts/$id (one alert)", () => {
    it("the stored condition and trigger by the field map's labels; delivery and references", () => {
        render(<AlertDetailView alert={ALERT_PRICE} busy={false} onAction={vi.fn()} onEdit={vi.fn()} />);

        for (const [label, value] of [["Operator", "crosses_above"], ["Level", "200"], ["Cooldown (seconds)", "3600"], ["Re-arm", "cross_back"]]) {
            expect(screen.getByText(label).nextSibling).toHaveTextContent(value);
        }

        expect(screen.getByText("Expires at").nextSibling?.textContent).toMatch(/2026/);

        expect(screen.getByText("Destinations").nextSibling).toHaveTextContent("Feed only");
    });

    it("the actions follow the status: pause an active alert, resume a triggered one; Duplicate opens the form pre-filled", () => {
        const onAction = vi.fn();

        const { unmount } = render(<AlertDetailView alert={ALERT_FILING} busy={false} onAction={onAction} onEdit={vi.fn()} />);

        const actions = screen.getByTestId("alert-actions");

        expect(within(actions).queryByRole("button", { name: "Resume" })).toBeNull();

        fireEvent.click(within(actions).getByRole("button", { name: "Pause" }));

        expect(onAction).toHaveBeenCalledWith("pause");

        expect(within(actions).getByRole("link", { name: "Duplicate" })).toHaveAttribute("href", `/alerts/new?from=${ALERT_FILING.id}`);

        unmount();

        render(<AlertDetailView alert={ALERT_DIVIDEND} busy={false} onAction={vi.fn()} onEdit={vi.fn()} />);

        expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();

        expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    });

    it("a disabled indicator alert: its reason on the badge, its template as stored", () => {
        render(<AlertDetailView alert={ALERT_INDICATOR} busy={false} onAction={vi.fn()} onEdit={vi.fn()} />);

        expect(screen.getByLabelText("Status Disabled: Its script aborted on 3 bars in a row.")).toBeInTheDocument();

        expect(screen.getByText("Template").nextSibling).toHaveTextContent("rsi-cross");
    });
});

describe("plan gate", () => {
    it("the area shows when the key's families hold Alerts (or while unknown)", () => {
        expect(plansAlerts({ allowed_families: ["Companies", "Alerts"] })).toBe(true);

        expect(plansAlerts({ allowed_families: ["Companies"] })).toBe(false);

        expect(plansAlerts(null)).toBe(true);
    });
});
