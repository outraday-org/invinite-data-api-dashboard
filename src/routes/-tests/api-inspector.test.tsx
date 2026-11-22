// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RequestMeta } from "@/lib/api/request-meta";

import { ApiButton, ApiRequestsView } from "@/components/api/api-sheet";
import { loadAllText } from "@/components/api/export-menu";
import { JSON_TREE_CHUNK, JsonTree } from "@/components/api/json-tree";
import { DataTable } from "@/components/ui/data-table";
import { fileRequests, shareWithRequests } from "@/lib/api/request-meta";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

vi.mock("@/lib/api/server-functions", () => ({ getApiBaseUrl: vi.fn(() => Promise.resolve({ url: "https://api.test" })) }));

afterEach(cleanup);

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

function Observed({ answer, enabled = true, queryKey }: { answer: unknown; enabled?: boolean; queryKey: string }) {
    useQuery({ enabled, initialData: answer, queryFn: () => answer, queryKey: [queryKey], staleTime: Number.POSITIVE_INFINITY });

    return null;
}

describe("API inspector", () => {
    it("lists every request on screen with summary, cost, request id, curl, CLI line and docs link", () => {
        render(<ApiRequestsView baseUrl="https://api.test" requests={[{ answer: { data: [] }, error: null, key: "k", meta: meta() }]} />);

        const card = screen.getByTestId("api-request");

        expect(within(card).getByText("/v1/dividends?limit=40&symbol=AAPL")).toBeInTheDocument();

        expect(within(card).getByText("List dividends")).toBeInTheDocument();

        expect(within(card).getByText("Base cost 1 credit · charged 1")).toBeInTheDocument();

        expect(within(card).getByText("req_abc")).toBeInTheDocument();

        expect(within(card).getByText("curl -sS -H \"Authorization: Bearer $INVINITE_API_KEY\" 'https://api.test/v1/dividends?limit=40&symbol=AAPL'")).toBeInTheDocument();

        expect(within(card).getByText("invd dividends list AAPL --limit 40")).toBeInTheDocument();

        expect(within(card).getByRole("link", { name: /Docs: listDividends/ })).toHaveAttribute("href", "https://data.invinite.com/docs/get--_v1_dividends");
    });

    it("the sheet reads the mounted queries' requests and never shows the stored key", async () => {
        useApiKeyStore.setState({ apiKey: STORED_KEY, hasHydrated: true });

        const client = new QueryClient({ defaultOptions: { queries: { structuralSharing: shareWithRequests } } });

        const answer = { data: [{ amount: 0.26, ex_date: "2026-11-10" }], has_more: false, next_cursor: null };

        fileRequests(answer, [meta()]);

        render(
            <QueryClientProvider client={client}>
                <Observed answer={answer} queryKey="dividends" />
                <ApiButton />
            </QueryClientProvider>,
        );

        fireEvent.click(screen.getByRole("button", { name: "API" }));

        expect(await screen.findByTestId("api-request")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Show answer (JSON)" }));

        // Open to depth 2: the envelope's fields, the rows collapsed.
        expect(screen.getByText("has_more:", { exact: false })).toBeInTheDocument();

        expect(document.body.innerHTML).not.toContain(STORED_KEY);

        expect(document.body.innerHTML).toContain("$INVINITE_API_KEY");
    });

    it("a hook switched off (a closed tab) keeps its cached answer but is not listed", async () => {
        const client = new QueryClient({ defaultOptions: { queries: { structuralSharing: shareWithRequests } } });

        const open = { data: [], has_more: false, next_cursor: null };

        const closed = { data: [], has_more: false, next_cursor: null };

        fileRequests(open, [meta({ operationId: "listFormCatalog", path: "/v1/catalog/forms", query: {} })]);

        fileRequests(closed, [meta({ operationId: "listMetricCatalog", path: "/v1/catalog/metrics", query: {} })]);

        render(
            <QueryClientProvider client={client}>
                <Observed answer={open} queryKey="forms" />
                <Observed answer={closed} enabled={false} queryKey="metrics" />
                <ApiButton />
            </QueryClientProvider>,
        );

        fireEvent.click(screen.getByRole("button", { name: "API" }));

        expect(await screen.findByText("/v1/catalog/forms")).toBeInTheDocument();

        expect(screen.getAllByTestId("api-request")).toHaveLength(1);

        expect(screen.queryByText("/v1/catalog/metrics")).toBeNull();
    });

    it("says so when the page made no request", () => {
        render(<ApiRequestsView baseUrl="https://api.test" requests={[]} />);

        expect(screen.getByText("No Data API request on this page yet.")).toBeInTheDocument();
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
