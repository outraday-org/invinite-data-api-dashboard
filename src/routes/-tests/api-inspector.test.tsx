// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ViewRequest } from "@/components/api/use-view-requests";
import type { RequestMeta } from "@/lib/api/request-meta";

import { loadAllText } from "@/components/api/export-menu";
import { JSON_TREE_CHUNK, JsonTree } from "@/components/api/json-tree";
import { RequestPanelView } from "@/components/api/request-panel";
import { useViewRequestCount, useViewRequests, viewRequestsOf, writeRequestsOf } from "@/components/api/use-view-requests";
import { DataTable } from "@/components/ui/data-table";
import { ApiRequestError } from "@/lib/api/errors";
import { fileRequests, shareWithRequests } from "@/lib/api/request-meta";
import { useApiKeyStore } from "@/lib/stores/api-key-store";
import { useRequestPanelStore } from "@/lib/stores/request-panel-store";

vi.mock("@/lib/api/server-functions", () => ({ getApiBaseUrl: vi.fn(() => Promise.resolve({ url: "https://api.test" })) }));

afterEach(() => {
    cleanup();

    // The code format is the panel's (shared by the rows, remembered): every test starts at curl.
    useRequestPanelStore.setState({ format: "curl" });
});

const STORED_KEY = "invd_live_secret_key_0123456789";

const meta = (patch: Partial<RequestMeta> = {}): RequestMeta => ({
    credits: 1,
    method: "GET",
    operationId: "listDividends",
    path: "/v1/dividends",
    query: { limit: "40", symbol: "AAPL" },
    requestId: "req_abc",
    status: 200,
    ...patch,
});

const viewRequest = (patch: Partial<ViewRequest> = {}): ViewRequest => ({
    answer: { data: [] },
    error: null,
    key: "[\"v2\",\"dividends\"]:0:0",
    meta: meta(),
    queryKey: ["v2", "dividends"],
    ...patch,
});

const view = (requests: ReadonlyArray<ViewRequest>, pathname = "/AAPL/dividends") => (
    <RequestPanelView baseUrl="https://api.test" pathname={pathname} requests={requests} />
);

function Observed({ answer, enabled = true, queryKey }: { answer: unknown; enabled?: boolean; queryKey: ReadonlyArray<string> }) {
    useQuery({ enabled, initialData: answer, queryFn: () => answer, queryKey, staleTime: Number.POSITIVE_INFINITY });

    return null;
}

const newClient = () => new QueryClient({ defaultOptions: { queries: { structuralSharing: shareWithRequests } } });

describe("Request panel view", () => {
    it("a row: method, path, query on its own line, status, credits, summary and plan; the first one open with curl", () => {
        render(view([viewRequest()]));

        const row = screen.getByTestId("api-request");

        expect(within(row).getByText("GET")).toBeInTheDocument();

        expect(within(row).getByText("/v1/dividends")).toBeInTheDocument();

        expect(within(row).getByText("?limit=40&symbol=AAPL")).toBeInTheDocument();

        expect(within(row).getByText("200")).toBeInTheDocument();

        expect(within(row).getByText("1c")).toBeInTheDocument();

        expect(within(row).getByText("List dividends")).toBeInTheDocument();

        expect(within(row).getByText("LITE")).toBeInTheDocument();

        // Expanded by default: curl with the shell variable, never a stored key; the request id; the docs.
        expect(within(row).getByRole("button", { expanded: true })).toBeInTheDocument();

        expect(within(row).getByText("curl -sS -H \"Authorization: Bearer $INVINITE_API_KEY\" 'https://api.test/v1/dividends?limit=40&symbol=AAPL'")).toBeInTheDocument();

        expect(within(row).getByText("req_abc")).toBeInTheDocument();

        expect(within(row).getByRole("link", { name: /Docs/ })).toHaveAttribute("href", "https://data.invinite.com/docs/get--_v1_dividends");

        fireEvent.click(within(row).getByRole("button", { name: "CLI" }));

        expect(within(row).getByText("invd dividends list AAPL --limit 40")).toBeInTheDocument();

        fireEvent.click(within(row).getByRole("button", { name: "Response" }));

        expect(within(row).getByText("data:", { exact: false })).toBeInTheDocument();
    });

    it("a code tab is every row's and \"Copy all as …\" copies it; Response is the row's alone", async () => {
        const writeText = vi.fn(() => Promise.resolve());

        Object.assign(navigator, { clipboard: { writeText } });

        const second = viewRequest({ key: "b:0:0", meta: meta({ operationId: "getFund", path: "/v1/funds/SPY", query: {} }), queryKey: ["v2", "fund"] });

        render(view([viewRequest(), second]));

        const rows = screen.getAllByTestId("api-request");

        fireEvent.click(within(rows[0]).getByRole("button", { name: "Python" }));

        expect(within(rows[0]).getByText(/CorporateActionsApi\(client\)\.list_dividends/)).toBeInTheDocument();

        // The whole label is the button.
        const copyAll = screen.getByRole("button", { name: "Copy all as Python" });

        expect(copyAll).toHaveTextContent("Copy all as Python");

        fireEvent.click(copyAll);

        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

        const copied = (writeText.mock.calls[0] as unknown as [string])[0];

        expect(copied).toContain(".list_dividends(");

        expect(copied).toContain(".get_fund(");

        // Another row opens in the same format.
        fireEvent.click(within(rows[1]).getByRole("button", { expanded: false }));

        expect(within(rows[1]).getByRole("button", { name: "Python" })).toHaveAttribute("aria-pressed", "true");

        // Answer leaves the copy format as it was.
        fireEvent.click(within(rows[0]).getByRole("button", { name: "Response" }));

        expect(screen.getByRole("button", { name: "Copy all as Python" })).toBeInTheDocument();

        fireEvent.click(within(rows[0]).getByRole("button", { name: "TypeScript" }));

        expect(screen.getByRole("button", { name: "Copy all as TypeScript" })).toBeInTheDocument();
    });

    it("the summary counts the page's requests and the credits charged; others start collapsed and expand", () => {
        const second = viewRequest({ key: "b:0:0", meta: meta({ credits: 5, operationId: "listSplits", path: "/v1/splits", requestId: null }), queryKey: ["v2", "splits"] });

        render(view([viewRequest(), second]));

        expect(screen.getByTestId("request-panel-summary")).toHaveTextContent("2 requests · 6 credits charged · api.test");

        const rows = screen.getAllByTestId("api-request");

        expect(within(rows[1]).getByRole("button", { expanded: false })).toBeInTheDocument();

        // Charged above the base cost (1): marked.
        expect(within(rows[1]).getByText("5c")).toHaveClass("text-warn");

        fireEvent.click(within(rows[1]).getByRole("button", { expanded: false }));

        expect(within(rows[1]).getByTestId("api-request-details")).toBeInTheDocument();

        // No request id stated: no request id line.
        expect(within(rows[1]).queryByText("Request id")).toBeNull();
    });

    it("a failed request shows its status and problem code, and the error text", () => {
        const error = new ApiRequestError(403, { error: "plan_required", message: "Your plan does not include this operation." });

        render(view([viewRequest({ answer: undefined, error, key: "x:error:0", meta: meta({ status: 403 }) })]));

        const row = screen.getByTestId("api-request");

        expect(within(row).getByText("403 plan_required")).toHaveClass("text-destructive");

        expect(within(row).getByText(/Your plan does not include this operation/)).toBeInTheDocument();

        expect(within(row).queryByRole("button", { name: "Response" })).toBeNull();
    });

    it("an operation the generated table does not know shows its path without a summary", () => {
        render(view([viewRequest({ meta: meta({ operationId: "unknown", path: "/v1/newer" }) })]));

        expect(screen.getByText("/v1/newer")).toBeInTheDocument();

        expect(screen.queryByText("List dividends")).toBeNull();
    });

    it("the empty state, and shell requests folded under App requests", () => {
        const live = viewRequest({ key: "live:0:0", meta: meta({ operationId: "listEvents", path: "/v1/events", query: { status: "live" } }), queryKey: ["v2", "events", "live"] });

        render(view([live]));

        expect(screen.getByText("This page has not asked the Data API yet.")).toBeInTheDocument();

        const group = screen.getByRole("button", { name: /App requests \(1\)/ });

        expect(group).toHaveAttribute("aria-expanded", "false");

        expect(screen.getByText("sidebar live count")).toBeInTheDocument();

        expect(screen.queryByText("/v1/events")).toBeNull();

        fireEvent.click(group);

        expect(screen.getByText("/v1/events")).toBeInTheDocument();

        expect(screen.getByText("Live streams (WebSocket) are not listed here.", { exact: false })).toBeInTheDocument();
    });

    it("a list's pages fold under its first row; a new page keeps an open row open", () => {
        const page = (index: number) => viewRequest({ key: `h:${index}:0`, meta: meta({ query: { cursor: `c${index}` }, requestId: `req_${index}` }) });

        const { rerender } = render(view([page(0), page(1)]));

        expect(screen.getByRole("button", { name: "1 more page" })).toBeInTheDocument();

        expect(screen.getByText("req_0")).toBeInTheDocument();

        rerender(view([page(0), page(1), page(2)]));

        expect(screen.getByRole("button", { name: "2 more pages" })).toBeInTheDocument();

        expect(screen.getByText("req_0")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "2 more pages" }));

        expect(screen.getByText("(page 3)")).toBeInTheDocument();
    });

    it("a write is listed under Writes with its answer redacted", async () => {
        const client = newClient();

        const answer = { id: "dst_1", secret: "whsec_live_secret" };

        fileRequests(answer, [meta({ body: { url: "https://hooks.test" }, method: "POST", operationId: "createDestination", path: "/v1/destinations", query: {} })]);

        await client.getMutationCache().build(client, { mutationFn: () => Promise.resolve(answer) }).execute(undefined);

        const writes = writeRequestsOf(client.getMutationCache().getAll());

        expect(writes[0].queryKey).toEqual(["write"]);

        render(view(writes, "/alerts/destinations"));

        fireEvent.click(screen.getByRole("button", { name: /Writes \(1\)/ }));

        expect(screen.getByText("POST")).toBeInTheDocument();

        // Writes start collapsed (only the page's first request opens by itself).
        fireEvent.click(screen.getByRole("button", { expanded: false, name: /\/v1\/destinations/ }));

        fireEvent.click(screen.getByRole("button", { name: "Response" }));

        expect(document.body.innerHTML).not.toContain("whsec_live_secret");

        expect(document.body.innerHTML).toContain("[redacted]");
    });
});

describe("useViewRequests / useViewRequestCount", () => {
    it("reads the mounted queries' requests with their query key, never a hook switched off, never the stored key", async () => {
        useApiKeyStore.setState({ apiKey: STORED_KEY, hasHydrated: true });

        const client = newClient();

        const open = { data: [], has_more: false, next_cursor: null };

        const closed = { data: [], has_more: false, next_cursor: null };

        fileRequests(open, [meta({ operationId: "listFormCatalog", path: "/v1/catalog/forms", query: {} })]);

        fileRequests(closed, [meta({ operationId: "listMetricCatalog", path: "/v1/catalog/metrics", query: {} })]);

        function Panel() {
            return view(useViewRequests(true), "/catalog");
        }

        render(
            <QueryClientProvider client={client}>
                <Observed answer={open} queryKey={["catalog", "forms"]} />
                <Observed answer={closed} enabled={false} queryKey={["catalog", "metrics"]} />
                <Panel />
            </QueryClientProvider>,
        );

        expect(await screen.findByText("/v1/catalog/forms")).toBeInTheDocument();

        expect(screen.getAllByTestId("api-request")).toHaveLength(1);

        expect(screen.queryByText("/v1/catalog/metrics")).toBeNull();

        expect(viewRequestsOf(client.getQueryCache().getAll())[0].queryKey).toEqual(["catalog", "forms"]);

        expect(document.body.innerHTML).not.toContain(STORED_KEY);
    });

    it("the toggle's count follows the cache while the panel is closed, counts page requests only, and re-renders only on a change", async () => {
        const client = newClient();

        const dividends = { data: [] };

        const live = { data: [] };

        fileRequests(dividends, [meta()]);

        fileRequests(live, [meta({ operationId: "listEvents", path: "/v1/events" })]);

        let renders = 0;

        const consoleError = vi.spyOn(console, "error");

        function Count() {
            return <span data-testid="count">{useViewRequestCount("/AAPL/dividends")}</span>;
        }

        render(
            <QueryClientProvider client={client}>
                <Observed answer={live} queryKey={["v2", "events", "live"]} />
                <Profiler id="count" onRender={() => { renders += 1; }}>
                    <Count />
                </Profiler>
            </QueryClientProvider>,
        );

        // The shell's live list is not the page's.
        expect(screen.getByTestId("count")).toHaveTextContent("0");

        const rendersBefore = renders;

        // An unrelated cache event (a query without filed requests) changes nothing: no re-render.
        act(() => {
            client.setQueryData(["other"], { x: 1 });
        });

        expect(renders).toBe(rendersBefore);

        act(() => {
            client.getQueryCache().build(client, { queryKey: ["v2", "dividends"] });
        });

        // A page query with an observer: mount one.
        render(
            <QueryClientProvider client={client}>
                <Observed answer={dividends} queryKey={["v2", "dividends"]} />
            </QueryClientProvider>,
        );

        expect(await screen.findByText("1")).toBeInTheDocument();

        consoleError.mockRestore();
    });

    it("a cache event fired while ANOTHER component renders is counted after that render, never inside it", async () => {
        const client = newClient();

        const plain = { data: [] };

        const filed = { data: [{ id: 1 }] };

        fileRequests(filed, [meta()]);

        const consoleError = vi.spyOn(console, "error");

        function Count() {
            return <span data-testid="count">{useViewRequestCount("/AAPL/dividends")}</span>;
        }

        // Like a `useQuery` building / updating a query in its render: the cache notifies synchronously.
        function UpdatesInRender() {
            client.setQueryData(["v2", "dividends"], filed);

            return null;
        }

        const { rerender } = render(
            <QueryClientProvider client={client}>
                <Observed answer={plain} queryKey={["v2", "dividends"]} />
                <Count />
            </QueryClientProvider>,
        );

        expect(screen.getByTestId("count")).toHaveTextContent("0");

        rerender(
            <QueryClientProvider client={client}>
                <Observed answer={plain} queryKey={["v2", "dividends"]} />
                <Count />
                <UpdatesInRender />
            </QueryClientProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

        expect(consoleError.mock.calls.filter(([message]) => String(message).includes("Cannot update a component"))).toEqual([]);

        consoleError.mockRestore();
    });
});

describe("JsonTree", () => {
    it("a 200-row answer renders its rows collapsed, 50 at a time", () => {
        const rows = Array.from({ length: 200 }, (_, index) => ({ id: index, nested: { deep: "x" } }));

        render(<JsonTree value={{ data: rows }} />);

        // Root and `data` open; each row (depth 2) collapsed: no row's fields rendered.
        expect(screen.queryByText("deep: ")).toBeNull();

        expect(screen.getAllByRole("button", { expanded: false })).toHaveLength(JSON_TREE_CHUNK);

        // The count says how many are shown of all (F095: "Show 26 more of 26" read as a tautology on the last chunk).
        fireEvent.click(screen.getByRole("button", { name: "Show 50 more (50 of 200 shown)" }));

        expect(screen.getAllByRole("button", { expanded: false })).toHaveLength(JSON_TREE_CHUNK * 2);

        expect(screen.getByRole("button", { name: "Show 50 more (100 of 200 shown)" })).toBeInTheDocument();
    });
});

describe("Export", () => {
    it("DataTable's Export menu sits above the table; load all names the per-page cost", () => {
        render(
            <DataTable
                columns={[{ accessorKey: "a", header: "A" }]}
                emptyText="none"
                exportConfig={{ dataset: "dividends", scope: "AAPL" }}
                hasNextPage
                isLoading={false}
                onLoadMore={() => {}}
                operationId="listDividends"
                rows={[{ a: 1 }]}
            />,
        );

        expect(screen.getByRole("button", { name: /Export/ })).toBeInTheDocument();

        expect(loadAllText("listDividends", 412)).toContain("412 rows are loaded");

        expect(loadAllText("listDividends", 412)).toContain("Each page costs 1 credit (List dividends), so at most 25 credits.");
    });
});
