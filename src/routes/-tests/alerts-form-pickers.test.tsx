// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScriptOptions } from "@/components/alerts/alert-form-pickers";

import { declaredInputsOf, destinationIdsOf, DestinationPicker, ReferenceCodePicker, ScriptInputsFields, ScriptVersionPicker, withInput } from "@/components/alerts/alert-form-pickers";
import { AlertFormView } from "@/components/alerts/alert-form-view";
import { emptyAlertForm, toCreateBody } from "@/lib/alerts/alert-form";
import { SCRIPT_FIXTURE, SCRIPT_V1_ERROR, SCRIPT_V2_OK, TEMPLATES_FIXTURE } from "@/lib/alerts/alerts-fixtures";
import { DESTINATION_ACTIVE, DESTINATION_DISABLED } from "@/lib/alerts/destinations-fixtures";
import { manifestInputs } from "@/lib/alerts/scripts";

vi.mock("@/lib/api/queries", () => ({ DESTINATION_QUERY_KEYS: { list: [] } }));

vi.mock("@/lib/api/mutations", () => ({ useApiMutation: () => ({ isPending: false, mutateAsync: vi.fn() }), useIdempotencyKey: () => ({ keyFor: vi.fn(), settle: vi.fn() }) }));

afterEach(cleanup);

const destinations = { data: [DESTINATION_ACTIVE, DESTINATION_DISABLED], error: null, isLoading: false };

const scriptOptions = (patch: Partial<ScriptOptions> = {}): ScriptOptions => ({
    error: null,
    isLoading: false,
    onScript: vi.fn(),
    scriptId: SCRIPT_FIXTURE.id,
    scripts: [SCRIPT_FIXTURE],
    versions: [SCRIPT_V2_OK, SCRIPT_V1_ERROR],
    ...patch,
});

describe("destination picker", () => {
    it("picks and unpicks into the form's id text; a disabled destination says so; an unlisted id stays as a chip", () => {
        const onChange = vi.fn();

        render(<DestinationPicker onChange={onChange} options={destinations} value={`dst_gone\n${DESTINATION_DISABLED.id}`} />);

        expect(screen.getByText(/Disabled: deliveries stop/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("checkbox", { name: DESTINATION_ACTIVE.description ?? DESTINATION_ACTIVE.url }));

        expect(onChange).toHaveBeenLastCalledWith(`dst_gone\n${DESTINATION_DISABLED.id}\n${DESTINATION_ACTIVE.id}`);

        fireEvent.click(screen.getByRole("button", { name: "Remove dst_gone" }));

        expect(onChange).toHaveBeenLastCalledWith(DESTINATION_DISABLED.id);

        expect(screen.getByText("2 of 10 picked.")).toBeInTheDocument();
    });

    it("at 10 picked the others cannot be added", () => {
        const ten = Array.from({ length: 10 }, (_, at) => `dst_${at}`).join("\n");

        render(<DestinationPicker onChange={vi.fn()} options={{ ...destinations, onNew: vi.fn() }} value={ten} />);

        expect(screen.getByRole("checkbox", { name: DESTINATION_ACTIVE.description ?? DESTINATION_ACTIVE.url })).toBeDisabled();

        expect(screen.getByRole("button", { name: "New destination…" })).toBeDisabled();

        expect(destinationIdsOf(ten)).toHaveLength(10);
    });

    it("the form sends the picked ids as before (toCreateBody unchanged)", () => {
        const state = { ...emptyAlertForm("filing"), destinationIds: [DESTINATION_ACTIVE.id, DESTINATION_DISABLED.id].join("\n") };

        expect(toCreateBody(state).body!.destination_ids).toEqual([DESTINATION_ACTIVE.id, DESTINATION_DISABLED.id]);
    });
});

describe("script version picker", () => {
    it("offers the picked script's compiled versions only", async () => {
        render(<ScriptVersionPicker id="sv" onChange={vi.fn()} options={scriptOptions()} value="" />);

        fireEvent.click(screen.getByRole("button", { name: "Script version" }));

        const items = within(await screen.findByRole("menu")).getAllByRole("menuitemradio").map(option => option.textContent);

        expect(items).toEqual(["Pick a version", `Version 2 · ${SCRIPT_V2_OK.id}`]);
    });

    it("a version id the lists do not show is kept and named", () => {
        render(<ScriptVersionPicker id="sv" onChange={vi.fn()} options={scriptOptions()} value="scv_older" />);

        expect(screen.getByText(/Version scv_older is kept/)).toBeInTheDocument();
    });

    it("the version's declared inputs become fields writing the inputs JSON; empty = the default", () => {
        const inputs = manifestInputs(SCRIPT_V2_OK.manifest);

        expect(declaredInputsOf(scriptOptions(), SCRIPT_V2_OK.id)).toEqual(inputs);

        expect(withInput("", inputs[0], "12")).toBe(JSON.stringify({ fast: 12 }, null, 2));

        expect(withInput(JSON.stringify({ fast: 12, slow: 30 }), inputs[0], "")).toBe(JSON.stringify({ slow: 30 }, null, 2));

        expect(withInput(JSON.stringify({ fast: 12 }), inputs[0], "")).toBe("");

        const onChange = vi.fn();

        render(<ScriptInputsFields inputs={inputs} onChange={onChange} text={JSON.stringify({ slow: 30 })} />);

        expect(screen.getByLabelText("Slow length")).toHaveValue("30");

        fireEvent.change(screen.getByLabelText("fast"), { target: { value: "5" } });

        expect(JSON.parse(onChange.mock.lastCall?.[0] as string)).toEqual({ fast: 5, slow: 30 });
    });

    it("in the form: a script alert shows the pickers instead of the id / JSON fields", () => {
        const state = { ...emptyAlertForm("script"), condition: { script_version_id: SCRIPT_V2_OK.id } };

        render(
            <AlertFormView
                destinationOptions={destinations}
                errors={{}}
                mode="create"
                onChange={vi.fn()}
                onSubmit={vi.fn()}
                pending={{ check: false, submit: false }}
                scriptOptions={scriptOptions()}
                state={state}
                templates={{ data: TEMPLATES_FIXTURE.data, error: null, isLoading: false }}
            />,
        );

        expect(screen.getByTestId("script-version-picker")).toBeInTheDocument();

        expect(screen.getByTestId("script-input-fields")).toBeInTheDocument();

        expect(screen.getByTestId("destination-picker")).toBeInTheDocument();

        expect(screen.queryByLabelText("Script version id")).toBeNull();
    });
});

describe("catalog-labelled reference codes", () => {
    it("named dividend/halt options still emit the exact schema code", async () => {
        const onChange = vi.fn();

        render(<ReferenceCodePicker codes={["CD", "SC"]} label="Dividend types" labelOf={code => code === "CD" ? "Regular cash" : "Special cash"} onChange={onChange} value={[]} />);

        fireEvent.click(screen.getByRole("button", { name: "Dividend types" }));

        fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "CD · Regular cash" }));

        expect(onChange).toHaveBeenCalledWith(["CD"]);
    });

    it("without catalog labels, the code remains a usable option", async () => {
        render(<ReferenceCodePicker codes={["T1"]} label="Reason codes" labelOf={code => code} onChange={vi.fn()} value={["T1"]} />);

        fireEvent.click(screen.getByRole("button", { name: "Reason codes" }));

        expect(await screen.findByRole("menuitemcheckbox", { name: "T1" })).toBeChecked();
    });
});
