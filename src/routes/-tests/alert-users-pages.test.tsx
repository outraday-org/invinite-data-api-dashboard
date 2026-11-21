// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AlertUsersListState } from "@/components/alerts/alert-user-list-view";

import { AlertUserDefaultsView } from "@/components/alerts/alert-user-defaults";
import { AlertUserDeleteResultNotice, AlertUserProfileView } from "@/components/alerts/alert-user-detail-view";
import { AlertUserBatchDialog, AlertUserBatchPreview, AlertUserEditDialog, upsertErrorsOf } from "@/components/alerts/alert-user-dialogs";
import { AlertUsersListView } from "@/components/alerts/alert-user-list-view";
import { alertUserOptions, AlertUserPicker } from "@/components/alerts/alert-user-picker";
import { emptyAlertUserForm, fromDefaults, parseAlertUserBatch } from "@/lib/alerts/alert-users";
import { DEFAULTS_FIXTURE, DELETE_RUNNING, ODD_USER_ID, USER_BATCH_PARTIAL, USER_ODD, USER_PAUSED, USERS_PAGE_FIXTURE } from "@/lib/alerts/alerts-fixtures";
import { ApiRequestError } from "@/lib/api/errors";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, className, params, to }: { children: React.ReactNode; className?: string; params?: Record<string, string>; to: string }) => (
        <a className={className} href={Object.entries(params ?? {}).reduce((path, [key, value]) => path.replace(`$${key}`, encodeURIComponent(value)), to)}>{children}</a>
    ),
}));

const mutations = vi.hoisted(() => ({ calls: [] as Array<{ input: Record<string, unknown>; operation: string }>, next: [] as Array<() => Promise<unknown>> }));

vi.mock("@/lib/api/mutations", () => ({
    useApiMutation: (operation: string) => ({
        isPending: false,
        mutateAsync: (input: Record<string, unknown>) => {
            mutations.calls.push({ input, operation });

            return (mutations.next.shift() ?? (() => Promise.resolve(USER_ODD)))();
        },
    }),
}));

vi.mock("@/lib/api/queries", () => ({ ALERT_QUERY_KEYS: { alert: [], event: [], events: [], list: [] }, ALERT_USER_QUERY_KEYS: { defaults: [], users: [] } }));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
    mutations.calls = [];

    mutations.next = [];
});

afterEach(cleanup);

const listState = (patch: Partial<AlertUsersListState> = {}): AlertUsersListState => ({
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    onLoadMore: vi.fn(),
    pages: [USERS_PAGE_FIXTURE],
    ...patch,
});

describe("/alerts/users list (`GET /v1/alert-users`)", () => {
    it("one row per end user: id linking its page (encoded), status, usage against the effective limits, last fired", () => {
        render(<AlertUsersListView busy={new Set()} onAction={vi.fn()} state={listState()} />);

        const odd = screen.getByRole("link", { name: ODD_USER_ID });

        expect(odd).toHaveAttribute("href", "/alerts/users/team%2Fa%3Ab%20c");

        const paused = screen.getByRole("link", { name: "user_8812" }).closest("tr")!;

        expect(within(paused).getByText("Jane (premium)")).toBeInTheDocument();

        expect(within(paused).getByLabelText("Status Paused")).toBeInTheDocument();

        // Own limits null: the effective ones are the account defaults.
        expect(within(paused).getByText("4 of 10")).toBeInTheDocument();

        expect(within(paused).getAllByText("· default")).toHaveLength(3);

        const smoke = screen.getByRole("link", { name: "smoke-a" }).closest("tr")!;

        expect(within(smoke).getByText("3 of 3")).toBeInTheDocument();

        expect(within(smoke).getByLabelText("Active alerts 100 % used")).toBeInTheDocument();

        expect(within(smoke).getAllByText("0 (no limit)")).toHaveLength(2);
    });

    it("a refused list renders the state, not an empty table", () => {
        render(<AlertUsersListView busy={new Set()} onAction={vi.fn()} state={listState({ error: new ApiRequestError(503, { error: "unavailable", message: "Alerts are off" }), pages: [] })} />);

        expect(screen.getByText("Alerts are switched off on the API right now")).toBeInTheDocument();
    });
});

describe("/alerts/users/$externalUserId", () => {
    it("profile, metadata, and each limit: own vs effective and where it comes from", () => {
        render(<AlertUserProfileView user={USER_PAUSED} />);

        const limits = screen.getByTestId("alert-user-limits");

        expect(within(limits).getByText("Not set: the account default applies (10).")).toBeInTheDocument();

        expect(within(limits).getByText("12 of 500")).toBeInTheDocument();

        expect(screen.getByText("Jane (premium)")).toBeInTheDocument();

        expect(screen.getByText(/premium/, { selector: "[data-slot=json-tree] *" })).toBeInTheDocument();
    });

    it("a delete's answer stays visible: `deleting` = the rest in the background", () => {
        const dismiss = vi.fn();

        render(<AlertUserDeleteResultNotice onDismiss={dismiss} outcome={{ externalUserId: "smoke-a", result: DELETE_RUNNING }} />);

        expect(screen.getByTestId("delete-result")).toHaveTextContent("Deleting: 3 alerts, 1,000 events and 1,000 deliveries removed so far");

        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

        expect(dismiss).toHaveBeenCalled();
    });
});

describe("add / edit an end user (PATCH upsert)", () => {
    it("sends every field it shows for the id as typed; empty limits = null", async () => {
        const onOpenChange = vi.fn();

        render(<AlertUserEditDialog defaults={DEFAULTS_FIXTURE} initial={emptyAlertUserForm()} mode="create" onOpenChange={onOpenChange} open />);

        expect(screen.getByText(/Empty = the account default \(2\)/)).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("End user id"), { target: { value: ODD_USER_ID } });

        fireEvent.change(screen.getByLabelText("Fires per day (UTC)"), { target: { value: "50" } });

        fireEvent.click(screen.getByRole("button", { name: "Add end user" }));

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

        expect(mutations.calls).toEqual([{
            input: { body: { display_name: null, max_active_alerts: null, max_fires_per_day: 50, max_script_alerts: null, metadata: {} }, externalUserId: ODD_USER_ID },
            operation: "updateAlertUser",
        }]);
    });

    it("a local problem is shown under its field and nothing is sent; an API 400 lands on its field", async () => {
        render(<AlertUserEditDialog defaults={null} initial={emptyAlertUserForm("x")} mode="create" onOpenChange={vi.fn()} open />);

        fireEvent.change(screen.getByLabelText("Active alerts"), { target: { value: "-3" } });

        fireEvent.click(screen.getByRole("button", { name: "Add end user" }));

        expect(await screen.findByText(/A whole number from 0 to 100,000,000/)).toBeInTheDocument();

        expect(mutations.calls).toHaveLength(0);

        expect(upsertErrorsOf(new ApiRequestError(400, { error: "invalid_parameter", message: "too long", param: "display_name" }))).toEqual({ display_name: "too long" });

        expect(upsertErrorsOf(new ApiRequestError(409, { error: "conflict", message: "being deleted" }))).toEqual({ form: "being deleted" });
    });
});

describe("bulk upsert", () => {
    it("the preview names the first problems; Send stays off until the paste is clean", () => {
        render(<AlertUserBatchPreview parsed={parseAlertUserBatch(JSON.stringify([{ external_user_id: "a", max_active_alerts: -1 }, { external_user_id: "b" }]))} />);

        expect(screen.getByTestId("batch-preview")).toHaveTextContent("Item 1: max_active_alerts: A whole number");
    });

    it("a paste of 3 sends one request and shows 3 per-item results", async () => {
        mutations.next = [() => Promise.resolve(USER_BATCH_PARTIAL)];

        render(<AlertUserBatchDialog onOpenChange={vi.fn()} open />);

        expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

        fireEvent.change(screen.getByLabelText("End users to create or update"), { target: { value: "external_user_id,max_active_alerts\nuser_9001,10\nuser_8812,50\ngone,1" } });

        expect(screen.getByTestId("batch-preview")).toHaveTextContent("3 end users to create or update.");

        fireEvent.click(screen.getByRole("button", { name: "Send 3 end users" }));

        const results = await screen.findByTestId("batch-results");

        expect(results).toHaveTextContent("2 of 3 done · 1 refused");

        expect(results).toHaveTextContent("user_9001: Created");

        expect(results).toHaveTextContent("gone: Refused: conflict — The end user is being deleted.");

        expect(mutations.calls).toHaveLength(1);

        expect(mutations.calls[0].input.items).toEqual([{ external_user_id: "user_9001", max_active_alerts: 10 }, { external_user_id: "user_8812", max_active_alerts: 50 }, { external_user_id: "gone", max_active_alerts: 1 }]);
    });
});

describe("end-user defaults", () => {
    it("reads null as no limit; Edit / Save hand the fields to the page", () => {
        const onSave = vi.fn();

        const view = (editing: boolean) => (
            <AlertUserDefaultsView defaults={DEFAULTS_FIXTURE} editing={editing} errors={{}} onCancel={vi.fn()} onChange={vi.fn()} onEdit={vi.fn()} onSave={onSave} pending={false} state={fromDefaults(DEFAULTS_FIXTURE)} />
        );

        const { rerender } = render(view(false));

        expect(screen.getAllByText("No limit")).toHaveLength(2);

        expect(screen.getByText("2")).toBeInTheDocument();

        rerender(view(true));

        expect(screen.getByLabelText("Active alerts")).toHaveValue("2");

        fireEvent.click(screen.getByRole("button", { name: "Save defaults" }));

        expect(onSave).toHaveBeenCalled();
    });
});

describe("the alert form's end-user picker", () => {
    it("suggests existing end users (display name and a non-active status as the label); free text stays allowed", () => {
        const options = alertUserOptions(USERS_PAGE_FIXTURE.data);

        expect(options).toEqual([{ id: "smoke-a", label: "" }, { id: ODD_USER_ID, label: "" }, { id: "user_8812", label: "Jane (premium) · Paused" }]);

        const onChange = vi.fn();

        render(<AlertUserPicker id="eu" onChange={onChange} options={options} value="" />);

        expect(screen.getByTestId("alert-user-options").querySelectorAll("option")).toHaveLength(3);

        fireEvent.change(screen.getByRole("combobox"), { target: { value: "brand-new" } });

        expect(onChange).toHaveBeenCalledWith("brand-new");
    });
});
