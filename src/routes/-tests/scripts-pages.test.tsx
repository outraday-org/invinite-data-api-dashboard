// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScriptDeleteConflict, ScriptSourceView, ScriptVersionsList, ScriptVersionView, sourceLineId } from "@/components/alerts/script-detail-view";
import { ScriptsListView } from "@/components/alerts/script-list-view";
import { ScriptUploadDialog } from "@/components/alerts/script-upload-dialog";
import { TemplateListView } from "@/components/alerts/template-list";
import { FIXTURE_SCRIPT_ID, SCRIPT_FIXTURE, SCRIPT_V1_ERROR, SCRIPT_V2_OK, SCRIPTS_PAGE_FIXTURE, TEMPLATE_RSI } from "@/lib/alerts/alerts-fixtures";
import { SCRIPT_SOURCE_MAX } from "@/lib/alerts/scripts";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, className, params, search, to }: { children: React.ReactNode; className?: string; params?: Record<string, string>; search?: Record<string, string>; to: string }) => {
        const path = Object.entries(params ?? {}).reduce((out, [key, value]) => out.replace(`$${key}`, value), to);

        const query = search ? `?${new URLSearchParams(search).toString()}` : "";

        return <a className={className} href={`${path}${query}`}>{children}</a>;
    },
}));

const mutations = vi.hoisted(() => ({ calls: [] as Array<{ input: Record<string, unknown>; operation: string }> }));

vi.mock("@/lib/api/mutations", () => ({
    useApiMutation: (operation: string) => ({
        isPending: false,
        mutateAsync: (input: Record<string, unknown>) => {
            mutations.calls.push({ input, operation });

            return Promise.resolve(operation === "createScript" ? SCRIPT_FIXTURE : SCRIPT_V2_OK);
        },
    }),
}));

vi.mock("@/lib/api/queries", () => ({ SCRIPT_QUERY_KEYS: { scripts: [] } }));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
    mutations.calls = [];
});

afterEach(cleanup);

describe("/alerts/scripts (`GET /v1/scripts`)", () => {
    it("name + description linking the script, versions of 20, the latest version's status and diagnostics", () => {
        render(<ScriptsListView state={{ error: null, hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: vi.fn(), pages: [SCRIPTS_PAGE_FIXTURE] }} />);

        expect(screen.getByRole("link", { name: "EMA cross" })).toHaveAttribute("href", `/alerts/scripts/${FIXTURE_SCRIPT_ID}`);

        const ok = screen.getByRole("link", { name: "EMA cross" }).closest("tr")!;

        expect(within(ok).getByText("2 of 20")).toBeInTheDocument();

        expect(within(ok).getByText("Compiled")).toBeInTheDocument();

        const full = screen.getByRole("link", { name: "At the limit" }).closest("tr")!;

        expect(within(full).getByText("20 of 20")).toBeInTheDocument();

        expect(within(full).getByText("Compile error")).toBeInTheDocument();

        expect(within(full).getByText("1 error, 1 warning")).toBeInTheDocument();
    });
});

describe("/alerts/scripts/$id", () => {
    it("versions newest first; picking one hands its number to the page", () => {
        const onSelect = vi.fn();

        render(<ScriptVersionsList onSelect={onSelect} selected={2} versions={[SCRIPT_V2_OK, SCRIPT_V1_ERROR]} />);

        const [v2, v1] = screen.getAllByRole("button");

        expect(v2).toHaveAttribute("aria-current", "true");

        fireEvent.click(v1);

        expect(onSelect).toHaveBeenCalledWith(1);
    });

    it("a compiled version: declared inputs, condition ids, no diagnostics, Create alert from this version", () => {
        render(<ScriptVersionView scriptId={FIXTURE_SCRIPT_ID} version={SCRIPT_V2_OK} />);

        const inputs = screen.getByTestId("script-inputs");

        expect(within(inputs).getByText("fast")).toBeInTheDocument();

        expect(within(inputs).getByText("1–200")).toBeInTheDocument();

        expect(within(inputs).getByText(/Slow length/)).toBeInTheDocument();

        expect(screen.getByText("main.ts:11:57#0")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: "Create alert from this version" })).toHaveAttribute("href", `/alerts/new?script=${FIXTURE_SCRIPT_ID}&type=script&version=${SCRIPT_V2_OK.id}`);
    });

    it("a failed compile: no Create alert, diagnostics linking their line, the lines marked in the source", () => {
        render(<ScriptVersionView scriptId={FIXTURE_SCRIPT_ID} version={SCRIPT_V1_ERROR} />);

        expect(screen.queryByRole("link", { name: "Create alert from this version" })).toBeNull();

        expect(screen.getByText("No manifest: the compile failed.")).toBeInTheDocument();

        const list = screen.getByTestId("script-diagnostics");

        expect(within(list).getByRole("link", { name: "9:22" })).toHaveAttribute("href", `#${sourceLineId(9)}`);

        const source = screen.getByTestId("script-source");

        expect(source.querySelector(`#${sourceLineId(9)}`)).toHaveAttribute("data-diagnostic", "error");

        expect(source.querySelector(`#${sourceLineId(6)}`)).toHaveAttribute("data-diagnostic", "warning");

        expect(source.querySelector(`#${sourceLineId(1)}`)).not.toHaveAttribute("data-diagnostic");
    });

    it("a source of thousands of lines renders one anchored row per line", () => {
        const source = Array.from({ length: 5000 }, (_, at) => `const v${at} = ${at};`).join("\n");

        render(<ScriptSourceView diagnostics={[{ code: "type-error", column: 1, line: 4321, message: "x", severity: "error" }]} source={source} />);

        const view = screen.getByTestId("script-source");

        expect(view.querySelectorAll("[id^=script-L]")).toHaveLength(5000);

        expect(view.querySelector(`#${sourceLineId(4321)}`)).toHaveAttribute("data-diagnostic", "error");
    });

    it("a refused delete (409) names the alerts that use the script, linked", () => {
        render(<ScriptDeleteConflict detail="The script is used by alerts alt_1, alt_2 and more" />);

        const links = within(screen.getByTestId("script-conflict-alerts")).getAllByRole("link");

        expect(links.map(link => link.getAttribute("href"))).toEqual(["/alerts/alt_1", "/alerts/alt_2"]);
    });
});

describe("upload", () => {
    it("a source above 204 800 characters is refused before upload (nothing sent)", async () => {
        render(<ScriptUploadDialog onOpenChange={vi.fn()} onUploaded={vi.fn()} open />);

        fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Big" } });

        fireEvent.change(screen.getByLabelText("Source"), { target: { value: "x".repeat(SCRIPT_SOURCE_MAX + 1) } });

        expect(screen.getByTestId("source-size")).toHaveTextContent("204,801 of 204,800 characters");

        fireEvent.click(screen.getByRole("button", { name: "Upload" }));

        expect(await screen.findByText(/at most 204,800 can be uploaded/)).toBeInTheDocument();

        expect(mutations.calls).toHaveLength(0);
    });

    it("the source box stops growing at half the window and scrolls itself (F116: Upload stays in reach)", () => {
        render(<ScriptUploadDialog onOpenChange={vi.fn()} onUploaded={vi.fn()} open />);

        expect(screen.getByLabelText("Source")).toHaveClass("max-h-[50vh]", "overflow-y-auto");
    });

    it("a script: name, description and source go to createScript; a version: only the source", async () => {
        const onUploaded = vi.fn();

        const { unmount } = render(<ScriptUploadDialog onOpenChange={vi.fn()} onUploaded={onUploaded} open />);

        fireEvent.change(screen.getByLabelText("Name"), { target: { value: " EMA cross " } });

        fireEvent.change(screen.getByLabelText("Source"), { target: { value: "export default 1;" } });

        fireEvent.click(screen.getByRole("button", { name: "Upload" }));

        await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ script: SCRIPT_FIXTURE }));

        expect(mutations.calls[0]).toEqual({ input: { description: undefined, name: "EMA cross", source: "export default 1;" }, operation: "createScript" });

        unmount();

        render(<ScriptUploadDialog onOpenChange={vi.fn()} onUploaded={onUploaded} open scriptId="scr_1" />);

        expect(screen.queryByLabelText("Name")).toBeNull();

        fireEvent.change(screen.getByLabelText("Source"), { target: { value: "export default 2;" } });

        fireEvent.click(screen.getByRole("button", { name: "Upload" }));

        await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ version: SCRIPT_V2_OK }));

        expect(mutations.calls[1]).toEqual({ input: { id: "scr_1", source: "export default 2;" }, operation: "createScriptVersion" });
    });
});

describe("templates tab (`GET /v1/alert-templates`)", () => {
    it("fidelity with its meaning, inputs with defaults and bounds, Use template → the indicator form", () => {
        render(<TemplateListView error={null} isLoading={false} templates={[TEMPLATE_RSI]} />);

        expect(screen.getByText(`Fidelity: ${TEMPLATE_RSI.fidelity}`)).toBeInTheDocument();

        expect(screen.getByRole("link", { name: "Use template" })).toHaveAttribute("href", `/alerts/new?template=${TEMPLATE_RSI.key}&type=indicator`);

        expect(screen.getByText(TEMPLATE_RSI.inputs[0].title)).toBeInTheDocument();
    });
});
