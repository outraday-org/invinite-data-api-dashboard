// @vitest-environment jsdom
import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DestinationEditorDialog } from "@/components/alerts/destination-editor";
import { useDestinationActions } from "@/components/alerts/use-destination-actions";
import { writeRequestsOf } from "@/components/api/use-view-requests";
import { DESTINATION_ACTIVE, DESTINATION_CREATED, DESTINATION_SECRET, FIXTURE_ROTATED_SECRET, FIXTURE_SECRET } from "@/lib/alerts/destinations-fixtures";
import { ApiRequestError } from "@/lib/api/errors";
import { fileRequests } from "@/lib/api/request-meta";
import { createDestination, rotateDestinationSecret } from "@/lib/api/server-functions-destinations";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

vi.mock("@/lib/api/server-functions-destinations", () => ({
    createDestination: vi.fn(),
    deleteDestination: vi.fn(),
    getDestination: vi.fn(),
    listDestinationDeliveries: vi.fn(),
    listDestinations: vi.fn(),
    rotateDestinationSecret: vi.fn(),
    testDestination: vi.fn(),
    updateDestination: vi.fn(),
}));

vi.mock("@/lib/api/queries", async (importOriginal) => {
    const actual: object = await importOriginal();

    return { ...actual, useAlertsInfinite: () => ({ data: null, error: null, isLoading: false }) };
});

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>, useNavigate: () => vi.fn() }));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

let client: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const clipboard = { writeText: vi.fn(() => Promise.resolve()) };

beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    useApiKeyStore.setState({ apiKey: "test-key", hasHydrated: true });

    Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });

    clipboard.writeText.mockClear();

    vi.mocked(createDestination).mockReset();

    vi.mocked(rotateDestinationSecret).mockReset();

    localStorage.clear();

    sessionStorage.clear();
});

afterEach(cleanup);

/** Everything the browser keeps: both caches (the inspector reads them), storage and the DOM. */
function everyStore() {
    return [
        JSON.stringify(client.getQueryCache().getAll().map(query => query.state)),
        JSON.stringify(client.getMutationCache().getAll().map(mutation => mutation.state)),
        JSON.stringify(writeRequestsOf(client.getMutationCache().getAll() as never).map(request => request.answer)),
        JSON.stringify({ ...localStorage }),
        JSON.stringify({ ...sessionStorage }),
        document.body.innerHTML,
    ].join("\n");
}

/** A create answer as the server function hands it over: a fresh object with its request filed (the inspector's registry). */
function createdAnswer() {
    const answer = structuredClone(DESTINATION_CREATED);

    fileRequests(answer, [{ credits: 1, method: "POST", operationId: "createDestination", path: "/v1/destinations", query: {}, requestId: "req_1", status: 201 }]);

    return answer;
}

describe("the signing secret is shown exactly once (create)", () => {
    it("after create: shown with copy and the 'not again' line; after closing it is in no cache, store or DOM node", async () => {
        const sent: Array<string> = [];

        vi.mocked(createDestination).mockImplementation((options) => {
            sent.push(JSON.stringify(options));

            return Promise.resolve(createdAnswer() as never);
        });

        const onCreated = vi.fn();

        const onClose = vi.fn();

        render(<DestinationEditorDialog destination={null} onClose={onClose} onCreated={onCreated} />, { wrapper });

        fireEvent.change(screen.getByLabelText("Endpoint URL"), { target: { value: "https://hooks.example.com/invinite-alerts" } });

        fireEvent.click(screen.getByRole("button", { name: "Add a header" }));

        fireEvent.change(screen.getByLabelText("Header name 1"), { target: { value: "X-Receiver-Token" } });

        fireEvent.change(screen.getByLabelText("Header value 1"), { target: { value: "tok_header_value" } });

        fireEvent.click(screen.getByRole("button", { name: "Create destination" }));

        expect(await screen.findByTestId("secret-value")).toHaveTextContent(FIXTURE_SECRET);

        expect(screen.getByText(/You will not see this secret again/)).toBeInTheDocument();

        // The typed header value went to the server function; the mutation cache keeps the name only (`forgetHeaderValues`).
        expect(JSON.parse(sent[0])).toEqual({ data: expect.objectContaining({ apiKey: "test-key", body: expect.objectContaining({ headers: { "X-Receiver-Token": "tok_header_value" } }), idempotencyKey: expect.any(String) }) });

        expect(JSON.stringify(client.getMutationCache().getAll().map(mutation => mutation.state.variables))).toContain("\"X-Receiver-Token\":\"[sent]\"");

        // While shown, the secret is in the dialog only: never in a cache or the inspector's view of the write.
        const whileShown = everyStore().replace(document.body.innerHTML, "");

        expect(whileShown).not.toContain(FIXTURE_SECRET);

        // Closing without copying asks first.
        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(screen.getByText(/Close without copying\?/)).toBeInTheDocument();

        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Keep it open" }));

        fireEvent.click(screen.getByRole("button", { name: "Copy the signing secret" }));

        await waitFor(() => expect(clipboard.writeText).toHaveBeenCalledWith(FIXTURE_SECRET));

        fireEvent.click(await screen.findByRole("button", { name: "Done" }));

        expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: DESTINATION_ACTIVE.id }));

        expect(onCreated.mock.calls[0][0]).not.toHaveProperty("secret");

        expect(onClose).toHaveBeenCalled();

        cleanup();

        const after = everyStore();

        expect(after).not.toContain(FIXTURE_SECRET);

        expect(after).not.toContain("tok_header_value");
    });

    it("a create retried after a lost answer sends the same Idempotency-Key (one destination)", async () => {
        vi.mocked(createDestination)
            .mockRejectedValueOnce(new TypeError("fetch failed"))
            .mockImplementationOnce(() => Promise.resolve(createdAnswer() as never));

        render(<DestinationEditorDialog destination={null} onClose={vi.fn()} />, { wrapper });

        fireEvent.change(screen.getByLabelText("Endpoint URL"), { target: { value: "https://hooks.example.com/a" } });

        fireEvent.click(screen.getByRole("button", { name: "Create destination" }));

        await screen.findByText("The API refused the destination");

        fireEvent.click(screen.getByRole("button", { name: "Create destination" }));

        await screen.findByTestId("secret-value");

        const keys = vi.mocked(createDestination).mock.calls.map(([options]) => (options as { data: { idempotencyKey: string } }).data.idempotencyKey);

        expect(keys).toHaveLength(2);

        expect(keys[0]).toBe(keys[1]);
    });

    it("the form checks https / port 443 itself and puts the API's refusal (private address) under the URL", async () => {
        vi.mocked(createDestination).mockRejectedValue(new ApiRequestError(400, { error: "invalid_parameter", message: "url: private addresses are not allowed", param: "url" }));

        render(<DestinationEditorDialog destination={null} onClose={vi.fn()} />, { wrapper });

        fireEvent.change(screen.getByLabelText("Endpoint URL"), { target: { value: "http://hooks.example.com" } });

        fireEvent.click(screen.getByRole("button", { name: "Create destination" }));

        expect(await screen.findByText(/must start with https/)).toBeInTheDocument();

        expect(createDestination).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText("Endpoint URL"), { target: { value: "https://10.0.0.1/hook" } });

        fireEvent.click(screen.getByRole("button", { name: "Create destination" }));

        expect(await screen.findByText("url: private addresses are not allowed")).toBeInTheDocument();
    });
});

function RotateHarness() {
    const actions = useDestinationActions();

    return (
        <>
            <button onClick={() => actions.request("rotate", DESTINATION_ACTIVE)} type="button">rotate</button>
            {actions.dialog}
        </>
    );
}

describe("the signing secret is shown exactly once (rotate)", () => {
    it("confirm states the 24 h overlap; the new secret shows once with the previous one's expiry; gone after closing", async () => {
        vi.mocked(rotateDestinationSecret).mockImplementation(() => Promise.resolve(structuredClone(DESTINATION_SECRET) as never));

        render(<RotateHarness />, { wrapper });

        fireEvent.click(screen.getByRole("button", { name: "rotate" }));

        expect(screen.getByText(/For 24 hours every delivery carries a signature/)).toBeInTheDocument();

        act(() => {
            fireEvent.click(screen.getByRole("button", { name: "Rotate secret" }));
        });

        expect(await screen.findByTestId("secret-value")).toHaveTextContent(FIXTURE_ROTATED_SECRET);

        expect(screen.getByText(/The previous secret keeps signing deliveries \(beside the new one\) until/)).toBeInTheDocument();

        expect(everyStore().replace(document.body.innerHTML, "")).not.toContain(FIXTURE_ROTATED_SECRET);

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        fireEvent.click(screen.getByRole("button", { name: "Close anyway" }));

        await waitFor(() => expect(screen.queryByTestId("secret-value")).toBeNull());

        expect(everyStore()).not.toContain(FIXTURE_ROTATED_SECRET);
    });
});
