// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BulkExportsResponse } from "@/lib/api/types";

import { ME_PRO } from "@/lib/account-fixtures";
import { BULK_EXPORT_POLL_MS, refetchWhileExportsOpen, useBulkExportsInfinite, useBulkFilesInfinite } from "@/lib/api/queries";
import { getMe, getV2Datasets } from "@/lib/api/server-functions";
import { createBulkExport, getBulkExportDownload, getBulkExports, getBulkFileDownload, getBulkFiles } from "@/lib/api/server-functions-bulk";
import {
    BULK_EXPORT_EXPIRED,
    BULK_EXPORT_FAILED,
    BULK_EXPORT_QUEUED,
    BULK_EXPORT_READY,
    BULK_EXPORT_READY_NPORT,
    BULK_FILE_PARSED,
    BULK_FILES_PAGE,
    BULK_SIGNED_URL,
    bulkDownload,
    bulkExportsPage,
} from "@/lib/sec/bulk-fixtures";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import { BulkExportsTab } from "@/routes/sec/-components/bulk-exports-tab";
import { BulkExportsView } from "@/routes/sec/-components/bulk-exports-view";
import { BulkFilesView } from "@/routes/sec/-components/bulk-files-view";
import { Route } from "@/routes/sec/datasets";

const route = vi.hoisted(() => ({ navigate: vi.fn(), search: {} as Record<string, unknown> }));

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options, useNavigate: () => route.navigate, useSearch: () => route.search }),
    Link: ({ children, params, to }: { children: React.ReactNode; params?: Record<string, string>; to: string }) => (
        <a href={Object.entries(params ?? {}).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

vi.mock("@/lib/api/server-functions-bulk", () => ({
    createBulkExport: vi.fn(),
    getBulkExport: vi.fn(),
    getBulkExportDownload: vi.fn(),
    getBulkExports: vi.fn(),
    getBulkFileDownload: vi.fn(),
    getBulkFiles: vi.fn(),
}));

vi.mock("@/lib/api/server-functions", () => ({ getMe: vi.fn(), getV2Datasets: vi.fn() }));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const ENTERPRISE = { ...ME_PRO, plan: "enterprise" as const };

let client: QueryClient;

const wrap = (node: React.ReactNode) => <QueryClientProvider client={client}>{node}</QueryClientProvider>;

function wrapper({ children }: { children: React.ReactNode }) {
    return wrap(children);
}

beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    route.search = {};

    route.navigate.mockReset();

    vi.mocked(toast.error).mockReset();

    vi.mocked(toast.success).mockReset();

    for (const fn of [getMe, getV2Datasets, getBulkFiles, getBulkExports, getBulkFileDownload, getBulkExportDownload, createBulkExport]) vi.mocked(fn).mockReset();

    useApiKeyStore.setState({ apiKey: "test-key", hasHydrated: true });
});

afterEach(() => {
    cleanup();

    vi.restoreAllMocks();
});

const Page = Route.options.component as React.ComponentType;

const filesView = (patch: Partial<React.ComponentProps<typeof BulkFilesView>> = {}) => (
    <BulkFilesView
        error={null}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        onChange={vi.fn()}
        onLoadMore={vi.fn()}
        pages={[BULK_FILES_PAGE]}
        search={{}}
        {...patch}
    />
);

/** The search a navigation wrote (`navigate({ replace, resetScroll, search: prev => next })`). */
function writtenSearch(call: number) {
    const options = route.navigate.mock.calls[call][0] as { replace: boolean; resetScroll: boolean; search: (prev: Record<string, unknown>) => Record<string, unknown> };

    expect(options).toMatchObject({ replace: true, resetScroll: false });

    return options.search(route.search);
}

describe("/sec/datasets · plan gate", () => {
    it("a non-Enterprise plan sees the notice on every tab and sends no bulk or data set request", async () => {
        vi.mocked(getMe).mockResolvedValue(ME_PRO);

        const { rerender } = render(wrap(<Page />));

        expect(await screen.findByText("Bulk downloads are part of the Enterprise plan")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: "Plans and billing in the Invinite Data app" })).toHaveAttribute("href", "https://data.invinite.com/billing");

        route.search = { tab: "exports" };

        rerender(wrap(<Page />));

        expect(await screen.findByText("Bulk downloads are part of the Enterprise plan")).toBeInTheDocument();

        route.search = { tab: "releases" };

        rerender(wrap(<Page />));

        expect(await screen.findByText("The SEC data set releases are part of the Enterprise plan")).toBeInTheDocument();

        expect(getBulkFiles).not.toHaveBeenCalled();

        expect(getBulkExports).not.toHaveBeenCalled();

        expect(getV2Datasets).not.toHaveBeenCalled();
    });

    it("an Enterprise key asks the open tab only, with the filters of the URL", async () => {
        vi.mocked(getMe).mockResolvedValue(ENTERPRISE);

        vi.mocked(getBulkFiles).mockResolvedValue(BULK_FILES_PAGE);

        route.search = { dataset: "f13", format: "zip", kind: "parsed", superseded: true };

        render(wrap(<Page />));

        expect(await screen.findByText("2026q3 · Jul 1, 2026 – Sep 30, 2026")).toBeInTheDocument();

        expect(getBulkFiles).toHaveBeenCalledTimes(1);

        // A format the kind lacks (zip under Parsed) is never sent.
        expect(vi.mocked(getBulkFiles).mock.calls[0][0]).toEqual({ data: { apiKey: "test-key", cursor: undefined, dataset: "f13", format: undefined, includeSuperseded: true, kind: "parsed", limit: 100, releasedFrom: undefined, releasedTo: undefined } });

        expect(getBulkExports).not.toHaveBeenCalled();

        expect(getV2Datasets).not.toHaveBeenCalled();
    });
});

describe("/sec/datasets · Files", () => {
    it("the filters and the tab write the URL in place; a kind change drops a format it lacks", async () => {
        vi.mocked(getMe).mockResolvedValue(ENTERPRISE);

        vi.mocked(getBulkFiles).mockResolvedValue(BULK_FILES_PAGE);

        route.search = { format: "parquet" };

        render(wrap(<Page />));

        await screen.findByText("2026q3 · Jul 1, 2026 – Sep 30, 2026");

        fireEvent.click(screen.getByRole("button", { name: "Kind" }));

        fireEvent.click(await screen.findByRole("menuitemradio", { name: "Raw SEC file" }));

        expect(writtenSearch(0)).toEqual({ format: undefined, kind: "raw" });

        fireEvent.click(screen.getByRole("button", { name: "Data set" }));

        fireEvent.click(await screen.findByRole("menuitemradio", { name: "Form N-PORT (fund holdings)" }));

        expect(writtenSearch(1)).toMatchObject({ dataset: "nport" });

        fireEvent.change(screen.getByLabelText("Released from"), { target: { value: "2026-01-01" } });

        expect(writtenSearch(2)).toMatchObject({ from: "2026-01-01" });

        fireEvent.click(screen.getByRole("button", { name: "Show superseded" }));

        expect(writtenSearch(3)).toMatchObject({ superseded: true });

        fireEvent.mouseDown(screen.getByRole("tab", { name: "Company exports" }));

        fireEvent.click(screen.getByRole("tab", { name: "Company exports" }));

        await waitFor(() => expect(route.navigate.mock.calls.length).toBeGreaterThan(4));

        expect(writtenSearch(route.navigate.mock.calls.length - 1)).toMatchObject({ tab: "exports" });
    });

    it("the validated URL: unknown values fall back, a superseded flag and an export id are kept", () => {
        const parse = (Route.options.validateSearch as { parse: (input: Record<string, unknown>) => Record<string, unknown> }).parse;

        expect(parse({ dataset: "f13", export: "bx_01JDXR2A4B6C8D0E2F4G6H8J0K", format: "csv_gz", from: "2026-01-01", kind: "parsed", superseded: true, tab: "exports" }))
            .toEqual({ dataset: "f13", export: "bx_01JDXR2A4B6C8D0E2F4G6H8J0K", format: "csv_gz", from: "2026-01-01", kind: "parsed", superseded: true, tab: "exports" });

        expect(parse({ dataset: "xbrl", export: "../x", format: "exe", kind: "cooked", tab: "everything", to: "2026-13-45" })).toEqual({});
    });

    it("an empty genuine list says so; each row reads its period, kind, size, rows and schema", () => {
        render(wrap(filesView()));

        const parsed = screen.getByText("2026q3 · Jul 1, 2026 – Sep 30, 2026").closest("tr")!;

        expect(within(parsed).getByText("Parsed · CSV.gz")).toBeInTheDocument();

        expect(within(parsed).getByText("46.0 MB")).toBeInTheDocument();

        expect(within(parsed).getByText("3,184,212")).toBeInTheDocument();

        expect(within(parsed).getByText("f13.v1")).toBeInTheDocument();

        cleanup();

        render(wrap(filesView({ pages: [{ ...BULK_FILES_PAGE, data: [], has_more: false, next_cursor: null }] })));

        expect(screen.getByText("No files match these filters.")).toBeInTheDocument();
    });
});

describe("Download (both tabs)", () => {
    it("asks the download operation on the click only, hands the URL to one anchor, and keeps it nowhere", async () => {
        vi.mocked(getBulkFileDownload).mockResolvedValue(bulkDownload());

        const clicked: Array<{ download: string; href: string }> = [];

        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            clicked.push({ download: this.download, href: this.href });
        });

        render(wrap(filesView({ pages: [{ ...BULK_FILES_PAGE, data: [BULK_FILE_PARSED] }] })));

        expect(getBulkFileDownload).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Download sec-f13-2026q3.csv.gz" }));

        await waitFor(() => expect(clicked).toHaveLength(1));

        expect(getBulkFileDownload).toHaveBeenCalledWith({ data: { apiKey: "test-key", fileId: BULK_FILE_PARSED.file_id } });

        expect(clicked[0]).toEqual({ download: "sec-f13-2026q3.csv.gz", href: BULK_SIGNED_URL });

        // No anchor stays in the page, no cache keeps the answer, no toast names the URL.
        expect(document.body.innerHTML).not.toContain("X-Amz-Signature");

        await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));

        expect(JSON.stringify(client.getQueryCache().getAll().map(query => query.state.data))).not.toContain("X-Amz-Signature");

        expect(toast.error).not.toHaveBeenCalled();

        expect(screen.getByRole("button", { name: "Download sec-f13-2026q3.csv.gz" })).toHaveTextContent("Download");
    });

    it("shows Preparing… while pending; a 429 toasts the daily cap and its reset once", async () => {
        let refuse: (reason: unknown) => void = () => undefined;

        vi.mocked(getBulkFileDownload).mockReturnValue(new Promise((_resolve, reject) => {
            refuse = reject;
        }));

        render(wrap(filesView({ pages: [{ ...BULK_FILES_PAGE, data: [BULK_FILE_PARSED] }] })));

        fireEvent.click(screen.getByRole("button", { name: "Download sec-f13-2026q3.csv.gz" }));

        expect(await screen.findByText("Preparing…")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Download sec-f13-2026q3.csv.gz" })).toBeDisabled();

        act(() => {
            refuse({ body: { error: "rate_limited", message: "The daily bulk download limit (500 download URLs per UTC day) is reached" }, code: "rate_limited", message: "The daily bulk download limit (500 download URLs per UTC day) is reached", status: 429 });
        });

        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));

        const [title, options] = vi.mocked(toast.error).mock.calls[0] as [string, { description: string }];

        expect(title).toBe("Download refused");

        expect(options.description).toMatch(/^The daily bulk download limit \(500 download URLs per UTC day\) is reached\. It resets at 00:00 UTC, in \d+ (h \d+ )?min\.$/);
    });
});

describe("Download of a ready export", () => {
    const exportsView = (rows = [BULK_EXPORT_READY]) => (
        <BulkExportsView error={null} hasNextPage={false} isFetchingNextPage={false} isLoading={false} onLoadMore={vi.fn()} onOpen={vi.fn()} pages={[bulkExportsPage(rows)]} />
    );

    it("asks getBulkExportDownload on the click and hands the URL to the anchor; nothing is kept", async () => {
        vi.mocked(getBulkExportDownload).mockResolvedValue({ ...bulkDownload(), filename: BULK_EXPORT_READY.filename! });

        const clicked: Array<string> = [];

        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            clicked.push(this.href);
        });

        render(wrap(exportsView()));

        expect(getBulkExportDownload).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: `Download ${BULK_EXPORT_READY.filename}` }));

        await waitFor(() => expect(clicked).toEqual([BULK_SIGNED_URL]));

        expect(getBulkExportDownload).toHaveBeenCalledWith({ data: { apiKey: "test-key", exportId: BULK_EXPORT_READY.export_id } });

        await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    });

    it("a 409 (not ready) toasts once and refreshes the exports list and the open detail", async () => {
        vi.mocked(getBulkExportDownload).mockRejectedValue({ body: { error: "conflict", message: "The export is running; its file can be downloaded once its status is ready" }, code: "conflict", message: "The export is running; its file can be downloaded once its status is ready", status: 409 });

        const invalidate = vi.spyOn(client, "invalidateQueries");

        render(wrap(exportsView()));

        fireEvent.click(screen.getByRole("button", { name: `Download ${BULK_EXPORT_READY.filename}` }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));

        expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([["v2", "bulk", "exports"], ["v2", "bulk", "export"]]);
    });
});

describe("/sec/datasets · Company exports", () => {
    /** Fills the form with one filer CIK and a range, then submits. */
    async function submitFilerExport() {
        fireEvent.change(screen.getByLabelText("Filer CIKs"), { target: { value: "102909" } });

        fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });

        fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-06-30" } });

        fireEvent.click(screen.getByRole("button", { name: "Create export" }));

        await waitFor(() => expect(screen.getByRole("button", { name: "Create export" })).toBeEnabled());
    }

    it("a 400's param lands on its field", async () => {
        vi.mocked(getBulkExports).mockResolvedValue(bulkExportsPage([]));

        vi.mocked(createBulkExport).mockRejectedValue({ body: { error: "invalid_parameter", message: "filer[0]: not a 13F manager", param: "filer[0]" }, code: "invalid_parameter", message: "filer[0]: not a 13F manager", status: 400 });

        render(wrap(<BulkExportsTab enabled onClose={vi.fn()} onOpen={vi.fn()} openExportId={undefined} />));

        await submitFilerExport();

        const field = screen.getByLabelText("Filer CIKs").closest("[data-field]")!;

        expect(within(field as HTMLElement).getByRole("alert")).toHaveTextContent("filer[0]: not a 13F manager");

        expect(toast.error).not.toHaveBeenCalled();
    });

    it("one Idempotency-Key per submission: reused on a retry after a lost answer, a new one after a success", async () => {
        vi.mocked(getBulkExports).mockResolvedValue(bulkExportsPage([]));

        vi.mocked(createBulkExport)
            .mockRejectedValueOnce(new Error("network down"))
            .mockResolvedValueOnce(BULK_EXPORT_QUEUED)
            .mockResolvedValueOnce(BULK_EXPORT_QUEUED);

        render(wrap(<BulkExportsTab enabled onClose={vi.fn()} onOpen={vi.fn()} openExportId={undefined} />));

        await submitFilerExport();

        fireEvent.click(screen.getByRole("button", { name: "Create export" }));

        await waitFor(() => expect(createBulkExport).toHaveBeenCalledTimes(2));

        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));

        fireEvent.click(screen.getByRole("button", { name: "Create export" }));

        await waitFor(() => expect(createBulkExport).toHaveBeenCalledTimes(3));

        const keys = vi.mocked(createBulkExport).mock.calls.map(([input]) => (input as { data: { idempotencyKey: string } }).data.idempotencyKey);

        expect(keys[1]).toBe(keys[0]);

        expect(keys[2]).not.toBe(keys[0]);

        expect(vi.mocked(createBulkExport).mock.calls[0][0]).toMatchObject({ data: { body: { dataset: "f13", date_field: "filed_date", filer: ["102909"], format: "csv_gz", from: "2026-01-01", to: "2026-06-30" } } });
    });

    it("the N-PORT scope sentence shows when N-PORT is picked", async () => {
        vi.mocked(getBulkExports).mockResolvedValue(bulkExportsPage([]));

        render(wrap(<BulkExportsTab enabled onClose={vi.fn()} onOpen={vi.fn()} openExportId={undefined} />));

        expect(screen.queryByTestId("nport-scope-note")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Data set" }));

        fireEvent.click(await screen.findByRole("menuitemradio", { name: "Form N-PORT (fund holdings)" }));

        expect(screen.getByTestId("nport-scope-note")).toHaveTextContent("N-PORT exports cover listed funds in full and unlisted funds as holders only (equity and fund shares). The period files on the Files tab hold every fund.");
    });

    it("rows: status with its meaning, coverage sentences; Download only while ready, never for an expired row", () => {
        render(wrap(<BulkExportsView error={null} hasNextPage={false} isFetchingNextPage={false} isLoading={false} onLoadMore={vi.fn()} onOpen={vi.fn()} pages={[bulkExportsPage([BULK_EXPORT_QUEUED, BULK_EXPORT_READY, BULK_EXPORT_READY_NPORT, BULK_EXPORT_EXPIRED, BULK_EXPORT_FAILED])]} />));

        const rows = screen.getAllByRole("row").slice(1);

        expect(within(rows[0]).getByLabelText("Status Queued")).toBeInTheDocument();

        expect(within(rows[0]).queryByRole("button", { name: /^Download/ })).toBeNull();

        expect(within(rows[1]).getByRole("button", { name: `Download ${BULK_EXPORT_READY.filename}` })).toBeInTheDocument();

        expect(within(rows[1]).getByText("Older periods are available as raw SEC zips on the Files tab.")).toBeInTheDocument();

        expect(within(rows[1]).getByRole("link", { name: "320193" })).toHaveAttribute("href", "/sec/320193");

        expect(within(rows[2]).getByText(/N-PORT exports cover listed funds in full/)).toBeInTheDocument();

        expect(within(rows[3]).getByLabelText("Status Expired")).toBeInTheDocument();

        expect(within(rows[3]).queryByRole("button", { name: /^Download/ })).toBeNull();

        expect(within(rows[4]).getByLabelText("Status Failed: scratch_full")).toBeInTheDocument();
    });
});

describe("polling of the exports list", () => {
    const page = (status: "queued" | "ready"): BulkExportsResponse => bulkExportsPage([{ ...BULK_EXPORT_QUEUED, status }]);

    it("every 5 s while a loaded export is queued / running, never once all settled", () => {
        expect(refetchWhileExportsOpen({ state: { data: { pageParams: [null], pages: [page("queued")] } } })).toBe(BULK_EXPORT_POLL_MS);

        expect(refetchWhileExportsOpen({ state: { data: { pageParams: [null], pages: [bulkExportsPage([{ ...BULK_EXPORT_QUEUED, status: "running" }])] } } })).toBe(BULK_EXPORT_POLL_MS);

        expect(refetchWhileExportsOpen({ state: { data: { pageParams: [null], pages: [page("ready")] } } })).toBe(false);

        expect(refetchWhileExportsOpen({ state: {} })).toBe(false);
    });

    it("the hook asks again while queued and stops once ready", async () => {
        vi.mocked(getBulkExports).mockResolvedValueOnce(page("queued")).mockResolvedValue(page("ready"));

        const { result } = renderHook(() => useBulkExportsInfinite(true), { wrapper });

        await waitFor(() => expect(result.current.data?.pages[0].data[0].status).toBe("queued"));

        await waitFor(() => expect(result.current.data?.pages[0].data[0].status).toBe("ready"), { timeout: BULK_EXPORT_POLL_MS + 3000 });

        expect(getBulkExports).toHaveBeenCalledTimes(2);

        const query = client.getQueryCache().getAll()[0];

        expect(refetchWhileExportsOpen(query as never)).toBe(false);
    }, BULK_EXPORT_POLL_MS + 10_000);

    it("a filter change starts at page 1: the cursor is never in the key", async () => {
        vi.mocked(getBulkFiles).mockResolvedValue(BULK_FILES_PAGE);

        const { rerender, result } = renderHook(({ dataset }: { dataset: "f13" | "nport" }) => useBulkFilesInfinite({ dataset }, true), { initialProps: { dataset: "f13" as "f13" | "nport" }, wrapper });

        await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

        await act(() => result.current.fetchNextPage());

        expect(vi.mocked(getBulkFiles).mock.calls[1][0]).toMatchObject({ data: { cursor: "c_files_2", dataset: "f13" } });

        rerender({ dataset: "nport" });

        await waitFor(() => expect(getBulkFiles).toHaveBeenCalledTimes(3));

        expect(vi.mocked(getBulkFiles).mock.calls[2][0]).toMatchObject({ data: { cursor: undefined, dataset: "nport" } });
    });

    it("the hook sends nothing while the plan gate keeps it idle", () => {
        renderHook(() => useBulkExportsInfinite(false), { wrapper });

        expect(getBulkExports).not.toHaveBeenCalled();
    });
});
