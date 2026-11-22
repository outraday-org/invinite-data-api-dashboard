// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DeliveriesListState } from "@/components/alerts/deliveries-view";
import type { DestinationsListState } from "@/components/alerts/destinations-list-view";

import { DeliveriesView, deliveryOutcomeText, TestDeliveryNotice } from "@/components/alerts/deliveries-view";
import { DestinationDetailView } from "@/components/alerts/destination-detail-view";
import { DestinationFormView } from "@/components/alerts/destination-form-view";
import { DestinationAlertsView } from "@/components/alerts/destination-parts";
import { DestinationsListView } from "@/components/alerts/destinations-list-view";
import { destinationConfirmWords } from "@/components/alerts/use-destination-actions";
import { ALERT_FILING, ALERT_PRICE } from "@/lib/alerts/alerts-fixtures";
import { destinationFormOf, emptyDestinationForm } from "@/lib/alerts/destinations";
import { DELIVERIES_PAGE_FIXTURE, DELIVERY_FAILED, DELIVERY_OK, DESTINATION_ACTIVE, DESTINATION_DISABLED, DESTINATIONS_PAGE_FIXTURE, fixtureDelivery } from "@/lib/alerts/destinations-fixtures";
import { ApiRequestError } from "@/lib/api/errors";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, params, search, to }: { children: React.ReactNode; params?: Record<string, string>; search?: Record<string, unknown>; to: string }) => {
        const path = Object.entries(params ?? {}).reduce((current, [key, value]) => current.replace(`$${key}`, value), to);

        const query = search ? `?${new URLSearchParams(Object.entries(search).map(([key, value]) => [key, String(value)])).toString()}` : "";

        return <a href={`${path}${query}`}>{children}</a>;
    },
}));

afterEach(cleanup);

const listState = (patch: Partial<DestinationsListState> = {}): DestinationsListState => ({
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    onLoadMore: vi.fn(),
    pages: [DESTINATIONS_PAGE_FIXTURE],
    ...patch,
});

const deliveriesState = (patch: Partial<DeliveriesListState> = {}): DeliveriesListState => ({
    error: null,
    hasNextPage: true,
    isFetchingNextPage: false,
    isLoading: false,
    onLoadMore: vi.fn(),
    pages: [DELIVERIES_PAGE_FIXTURE],
    ...patch,
});

describe("DestinationsListView (`GET /v1/destinations`)", () => {
    it("one row per destination: URL linking its page, description, kind · preset, status, rate, digest, secret hint", () => {
        render(<DestinationsListView actions={{ busy: new Set(), onAction: vi.fn() }} state={listState()} />);

        const link = screen.getByRole("link", { name: DESTINATION_ACTIVE.url });

        expect(link).toHaveAttribute("href", `/alerts/destinations/${DESTINATION_ACTIVE.id}`);

        const row = link.closest("tr")!;

        expect(row).toHaveTextContent("Production alert receiver");

        expect(row).toHaveTextContent("Webhook · Standard");

        expect(row).toHaveTextContent("600 / min");

        expect(row).toHaveTextContent("Off");

        expect(row).toHaveTextContent("whsec_…abcd");

        expect(within(row).getByRole("cell", { name: "X-Receiver-Token" })).toBeInTheDocument();

        const failing = screen.getByRole("link", { name: DESTINATION_DISABLED.url }).closest("tr")!;

        expect(failing).toHaveTextContent("14 failed in a row");

        expect(failing).toHaveTextContent("Batch webhook · Standard");

        expect(failing).toHaveTextContent("60 s");

        expect(within(failing).getByRole("cell", { name: "None" })).toBeInTheDocument();

        expect(within(failing).getByLabelText(/Status Disabled: Disabled after only failures for 72 hours/)).toBeInTheDocument();
    });

    it("a disabled destination offers no test delivery in its row (the detail page disables it too)", () => {
        render(<DestinationsListView actions={{ busy: new Set(), onAction: vi.fn() }} state={listState({ pages: [{ ...DESTINATIONS_PAGE_FIXTURE, data: [DESTINATION_DISABLED] }] })} />);

        fireEvent.click(screen.getByRole("button", { name: `Actions for ${DESTINATION_DISABLED.id}` }));

        expect(screen.queryByText("Send test delivery…")).toBeNull();

        expect(screen.getByText("Re-enable…")).toBeInTheDocument();
    });

    it("a 503 is the switched-off notice, never an empty list", () => {
        render(<DestinationsListView actions={{ busy: new Set(), onAction: vi.fn() }} state={listState({ error: new ApiRequestError(503, { error: "unavailable", message: "off" }), pages: [] })} />);

        expect(screen.getByText("Alerts are switched off on the API right now")).toBeInTheDocument();
    });
});

describe("DestinationDetailView", () => {
    it("a disabled destination shows its reason and Re-enable; header names only, never values", () => {
        const onAction = vi.fn();

        render(<DestinationDetailView busy={false} destination={DESTINATION_DISABLED} onAction={onAction} onEdit={vi.fn()} />);

        expect(screen.getByTestId("disabled-reason")).toHaveTextContent("Disabled after only failures for 72 hours with at least 10 failed attempts in a row.");

        fireEvent.click(screen.getByRole("button", { name: "Re-enable…" }));

        expect(onAction).toHaveBeenCalledWith("enable");

        expect(screen.getByRole("button", { name: "Send test delivery…" })).toBeDisabled();
    });

    it("an active one: actions, settings with header names, the rotation window", () => {
        const onAction = vi.fn();

        render(<DestinationDetailView busy={false} destination={{ ...DESTINATION_ACTIVE, previous_secret_expires_at: "2026-11-22T14:00:00Z" }} onAction={onAction} onEdit={vi.fn()} />);

        expect(screen.getByText("X-Receiver-Token (values are never shown)")).toBeInTheDocument();

        expect(screen.getByText(/Still signs until/)).toBeInTheDocument();

        for (const [name, action] of [["Send test delivery…", "test"], ["Rotate secret…", "rotate"], ["Disable…", "disable"], ["Delete…", "delete"]] as const) {
            fireEvent.click(screen.getByRole("button", { name }));

            expect(onAction).toHaveBeenLastCalledWith(action);
        }
    });
});

describe("DestinationAlertsView (`listAlerts?destination_id=`)", () => {
    it("N when the first page is the only one, N+ when more exist; each alert links its page", () => {
        render(<DestinationAlertsView state={{ alerts: [ALERT_FILING, ALERT_PRICE], error: null, hasMore: false, isLoading: false }} />);

        expect(screen.getByTestId("destination-alerts")).toHaveTextContent("2 alerts deliver here");

        expect(screen.getByRole("link", { name: "SEC filing · watchlist-aapl-8k" })).toHaveAttribute("href", `/alerts/${ALERT_FILING.id}`);

        cleanup();

        render(<DestinationAlertsView state={{ alerts: [ALERT_FILING], error: null, hasMore: true, isLoading: false }} />);

        expect(screen.getByTestId("destination-alerts")).toHaveTextContent("1+ alerts deliver here");

        cleanup();

        render(<DestinationAlertsView state={{ alerts: [], error: null, hasMore: false, isLoading: false }} />);

        expect(screen.getByTestId("destination-alerts")).toHaveTextContent("No alert delivers here.");
    });
});

describe("DeliveriesView (`listDestinationDeliveries`, newest first)", () => {
    it("status, event link, batch, attempts, last HTTP status, last error, duration, next attempt", () => {
        render(<DeliveriesView onStatusChange={vi.fn()} state={deliveriesState()} status={null} />);

        const event = screen.getByRole("link", { name: DELIVERY_FAILED.event_id });

        expect(event).toHaveAttribute("href", `/alerts/events?event=${DELIVERY_FAILED.event_id}`);

        const failed = event.closest("tr")!;

        expect(failed).toHaveTextContent("Timed out");

        expect(failed).toHaveTextContent("10,000 ms");

        expect(within(failed).getByLabelText("Delivery Failed")).toBeInTheDocument();

        const ok = screen.getByRole("link", { name: DELIVERY_OK.event_id }).closest("tr")!;

        expect(ok).toHaveTextContent("HTTP 200");

        expect(screen.getByText("bat_01")).toBeInTheDocument();

        cleanup();

        render(<DeliveriesView onStatusChange={vi.fn()} state={deliveriesState({ pages: [{ ...DELIVERIES_PAGE_FIXTURE, data: [fixtureDelivery("b1", { batch_id: "bat_09" }), fixtureDelivery("b2", { batch_id: "bat_09" })] }] })} status={null} />);

        expect(screen.getAllByText("bat_09 (2)")).toHaveLength(2);
    });

    it("the status filter runs over the loaded rows and says so", () => {
        render(<DeliveriesView onStatusChange={vi.fn()} state={deliveriesState()} status="dead" />);

        expect(screen.getByTestId("deliveries-filter-note")).toHaveTextContent("1 of the 3 loaded deliveries (older ones are not loaded: the API has no status filter).");

        expect(screen.queryByRole("link", { name: DELIVERY_OK.event_id })).toBeNull();
    });

    it("the test notice: waiting, the outcome with HTTP status, or no outcome after 30 s", () => {
        const pending = fixtureDelivery("t", { delivered_at: null, last_status: null, status: "pending" });

        render(<TestDeliveryNotice deliveryId="dlv_t" onDismiss={vi.fn()} onRefresh={vi.fn()} tracking={{ delivery: pending, state: "waiting" }} />);

        expect(screen.getByText(/Waiting for its outcome \(now pending\)/)).toBeInTheDocument();

        cleanup();

        render(<TestDeliveryNotice deliveryId="dlv_ok" onDismiss={vi.fn()} onRefresh={vi.fn()} tracking={{ delivery: DELIVERY_OK, state: "done" }} />);

        expect(screen.getByTestId("test-outcome")).toHaveTextContent("Succeeded · HTTP 200 · 182 ms");

        cleanup();

        const onRefresh = vi.fn();

        render(<TestDeliveryNotice deliveryId="dlv_t" onDismiss={vi.fn()} onRefresh={onRefresh} tracking={{ delivery: null, state: "timed_out" }} />);

        expect(screen.getByText("No outcome for test delivery dlv_t after 30 s")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Refresh the log" }));

        expect(onRefresh).toHaveBeenCalled();

        expect(deliveryOutcomeText(DELIVERY_FAILED)).toMatch(/^Failed · Timed out · 10,000 ms · next attempt/);
    });
});

describe("DestinationFormView", () => {
    it("header values are write-only inputs (password, no autofill)", () => {
        render(<DestinationFormView errors={{}} mode="create" onChange={vi.fn()} onSubmit={vi.fn()} pending={false} state={{ ...emptyDestinationForm(), headerRows: [{ name: "X-A", value: "tok" }] }} />);

        const value = screen.getByLabelText("Header value 1");

        expect(value).toHaveAttribute("type", "password");

        expect(value).toHaveAttribute("autocomplete", "new-password");

        expect(screen.getByRole("button", { name: "Create destination" })).toBeInTheDocument();
    });

    it("edit shows the stored header names, keeps them by default, and offers replace / remove", () => {
        const onChange = vi.fn();

        render(<DestinationFormView errors={{ url: "Port 8443 is not allowed" }} mode="edit" onChange={onChange} onSubmit={vi.fn()} pending={false} state={destinationFormOf(DESTINATION_ACTIVE)} storedHeaderNames={DESTINATION_ACTIVE.header_names} />);

        expect(screen.getByTestId("stored-header-names")).toHaveTextContent("Stored: X-Receiver-Token (values hidden).");

        expect(screen.queryByLabelText("Header value 1")).toBeNull();

        expect(screen.getByRole("radio", { name: "Keep the stored headers" })).toHaveAttribute("aria-checked", "true");

        fireEvent.click(screen.getByRole("radio", { name: "Remove all" }));

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ headersMode: "remove" }));

        expect(screen.getByText("Port 8443 is not allowed")).toBeInTheDocument();
    });
});

describe("confirmations state the effect", () => {
    it("test, rotate, disable, re-enable and delete each ask first with what happens", () => {
        expect(destinationConfirmWords("test", DESTINATION_ACTIVE).effect).toBe(`Sends one signed destination.test event to ${DESTINATION_ACTIVE.url} — a real request to your endpoint. Its delivery shows in the destination's delivery log.`);

        expect(destinationConfirmWords("rotate", DESTINATION_ACTIVE).effect).toMatch(/For 24 hours every delivery carries a signature with the current secret AND the new one/);

        expect(destinationConfirmWords("delete", DESTINATION_ACTIVE)).toMatchObject({ destructive: true, effect: expect.stringMatching(/alerts that named it stop sending to it/) });

        expect(destinationConfirmWords("enable", DESTINATION_DISABLED).effect).toMatch(/failure counter resets to 0/);

        expect(destinationConfirmWords("disable", DESTINATION_ACTIVE).confirmLabel).toBe("Disable");
    });
});
