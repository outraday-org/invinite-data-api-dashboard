import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// @vitest-environment jsdom
import type * as MutationsModule from "@/lib/api/mutations";

import { CreateAlertForm, EditAlertForm } from "@/components/alerts/alert-editor";
import { AlertFormView, rangeText } from "@/components/alerts/alert-form-view";
import { emptyAlertForm, fromAlert } from "@/lib/alerts/alert-form";
import { ALERT_FILING, ALERT_PRICE, TEMPLATES_FIXTURE } from "@/lib/alerts/alerts-fixtures";
import { ApiRequestError } from "@/lib/api/errors";

const mutations = vi.hoisted(() => ({ calls: [] as Array<{ input: Record<string, unknown>; operation: string }>, next: [] as Array<() => Promise<unknown>> }));

vi.mock("@/lib/api/mutations", async importOriginal => ({
    ...(await importOriginal<typeof MutationsModule>()),
    useApiMutation: (operation: string) => ({
        isPending: false,
        mutateAsync: (input: Record<string, unknown>) => {
            mutations.calls.push({ input, operation });

            return (mutations.next.shift() ?? (() => Promise.resolve({ id: "alt_new", type: "filing" })))();
        },
    }),
}));

vi.mock("@/lib/api/queries", () => ({
    ALERT_QUERY_KEYS: { alert: ["a"], event: ["e"], events: ["es"], list: ["l"], templates: ["t"] },
    useAlertsQuota: () => ({ data: null }),
    useAlertTemplates: () => ({ data: TEMPLATES_FIXTURE, error: null, isLoading: false }),
}));

const navigate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
    mutations.calls = [];

    mutations.next = [];

    navigate.mockReset();
});

afterEach(cleanup);

const view = (patch: Partial<Parameters<typeof AlertFormView>[0]> = {}) => (
    <AlertFormView
        errors={{}}
        mode="create"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        pending={{ check: false, submit: false }}
        state={emptyAlertForm("price")}
        templates={{ data: TEMPLATES_FIXTURE.data, error: null, isLoading: false }}
        {...patch}
    />
);

describe("AlertFormView (one form from the field map)", () => {
    it("a price alert shows the price fields and the price trigger fields, nothing of other types", () => {
        render(view());

        for (const label of ["Symbol", "Asset class", "Operator", "Level", "Mode", "Cooldown (seconds)", "Re-arm", "Re-arm distance (%)", "Max fires", "Destinations", "End user id", "Client reference id"]) {
            expect(screen.getAllByText(label).length, label).toBeGreaterThan(0);
        }

        expect(screen.queryByText("Form types")).toBeNull();

        expect(screen.queryByText("Cooldown (bars)")).toBeNull();

        expect(screen.getByText("The price crosses, or is above / below, a level.")).toBeInTheDocument();
    });

    it("field errors sit under their field; the form's own under the form", () => {
        render(view({ errors: { "condition.level": "level: must be > 0", "form": "Something else." } }));

        expect(screen.getByText("level: must be > 0").closest("[data-field]")).toHaveAttribute("data-field", "alert-field-condition-level");

        expect(screen.getByText("Something else.")).toBeInTheDocument();
    });

    it("the indicator switches between its template (inputs from the template, fidelity shown) and a structured condition", () => {
        const onChange = vi.fn();

        const state = { ...emptyAlertForm("indicator"), template: { inputs: {}, key: "rsi-cross" } };

        render(view({ onChange, state }));

        expect(screen.getByText("Fidelity: lossy")).toBeInTheDocument();

        expect(screen.getByText("Length")).toBeInTheDocument();

        expect(screen.queryByText("Structured condition", { selector: "label" })).toBeNull();

        fireEvent.click(screen.getByRole("radio", { name: "Structured condition" }));

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ indicatorMode: "structured" }));
    });

    it("numeric bounds as a hint", () => {
        expect(rangeText({ max: 90, min: 0 })).toBe(" (0–90)");

        expect(rangeText({ min: 0 })).toBe(" (at least 0)");

        expect(rangeText({ max: 6 })).toBe(" (at most 6)");

        expect(rangeText({})).toBe("");
    });

    it("editing keeps the type fixed and says so; Check only on create", () => {
        render(view({ mode: "edit", onCheck: undefined }));

        expect(screen.getByText(/The type of an alert never changes/)).toBeInTheDocument();

        expect(screen.queryByRole("button", { name: "Check" })).toBeNull();

        expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    });
});

describe("CreateAlertForm", () => {
    it("Check sends validate_only and says nothing was created", async () => {
        mutations.next.push(() => Promise.resolve({ done: "validated", id: null }));

        render(<CreateAlertForm initial={fromAlert(ALERT_PRICE, { duplicate: true })} />);

        fireEvent.click(screen.getByRole("button", { name: "Check" }));

        await screen.findByText("The API accepted this alert");

        expect(mutations.calls[0]).toMatchObject({ input: { validateOnly: true }, operation: "createAlert" });

        expect(mutations.calls[0].input.idempotencyKey).toBeUndefined();
    });

    it("a retry after a lost answer sends the same Idempotency-Key; the created alert opens its page", async () => {
        mutations.next.push(() => Promise.reject(new TypeError("Failed to fetch")));

        render(<CreateAlertForm initial={fromAlert(ALERT_FILING, { duplicate: true })} />);

        fireEvent.click(screen.getByRole("button", { name: "Create alert" }));

        await screen.findByText("The API refused the alert");

        fireEvent.click(screen.getByRole("button", { name: "Create alert" }));

        await waitFor(() => expect(navigate).toHaveBeenCalledWith({ params: { id: "alt_new" }, to: "/alerts/$id" }));

        const keys = mutations.calls.map(call => call.input.idempotencyKey);

        expect(keys).toHaveLength(2);

        expect(keys[0]).toBe(keys[1]);

        expect(mutations.calls[0].input.body).toMatchObject({ condition: ALERT_FILING.condition, type: "filing" });
    });

    it("a 400 puts the API's problems under their fields", async () => {
        mutations.next.push(() => Promise.reject(new ApiRequestError(400, {
            error: "invalid_parameter",
            errors: [{ code: "invalid_parameter", detail: "level: must be greater than 0", param: "condition.level" }],
            message: "1 problem",
        })));

        render(<CreateAlertForm initial={fromAlert(ALERT_PRICE, { duplicate: true })} />);

        fireEvent.click(screen.getByRole("button", { name: "Create alert" }));

        const message = await screen.findByText("level: must be greater than 0");

        expect(message.closest("[data-field]")).toHaveAttribute("data-field", "alert-field-condition-level");
    });

    it("a full quota (403 plan_required) is its own notice with a way to the numbers", async () => {
        mutations.next.push(() => Promise.reject(new ApiRequestError(403, { error: "plan_required", message: "The active-alert quota of your plan (100) is full." })));

        render(<CreateAlertForm initial={fromAlert(ALERT_PRICE, { duplicate: true })} />);

        fireEvent.click(screen.getByRole("button", { name: "Create alert" }));

        expect(await screen.findByText("The plan's alert quota or access refused this alert")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Show the quota (1 credit)" })).toBeInTheDocument();
    });
});

describe("EditAlertForm", () => {
    it("sends the version it was loaded at; a 409 conflict says changed elsewhere and offers a reload", async () => {
        mutations.next.push(() => Promise.reject(new ApiRequestError(409, { error: "conflict", message: "The alert is at version 2" })));

        const onReload = vi.fn();

        const { rerender } = render(<EditAlertForm alert={ALERT_PRICE} initial={fromAlert(ALERT_PRICE)} onDone={vi.fn()} onReload={onReload} />);

        // A background refetch moves the alert's version: the form still sends the one it was loaded at.
        rerender(<EditAlertForm alert={{ ...ALERT_PRICE, version: 2 }} initial={fromAlert(ALERT_PRICE)} onDone={vi.fn()} onReload={onReload} />);

        fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

        await waitFor(() => expect(mutations.calls).toHaveLength(1));

        expect(mutations.calls[0]).toMatchObject({ input: { body: { version: 1 }, id: ALERT_PRICE.id }, operation: "updateAlert" });

        expect(await screen.findByText("This alert changed elsewhere since you opened it")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Reload the alert" }));

        expect(onReload).toHaveBeenCalledTimes(1);
    });
});
