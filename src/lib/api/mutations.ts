import type { QueryKey } from "@tanstack/react-query";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { ApiRequestError, rethrowApiError } from "./errors";
import { batchAlerts, createAlert, deleteAlert, pauseAlert, resumeAlert, testAlert, updateAlert } from "./server-functions-alerts";

/**
 * The write layer (backend tasks/data-api-dashboard 2-alerts task 2): one entry per write operation (A3 appends the
 * destination writes, A4 the alert-user / script writes), each a `POST` server function.
 */
const WRITES = {
    batchAlerts,
    createAlert,
    deleteAlert,
    pauseAlert,
    resumeAlert,
    testAlert,
    updateAlert,
};

export type WriteOperationId = keyof typeof WRITES;

type WriteFunction<TOperation extends WriteOperationId> = (typeof WRITES)[TOperation];

/** A write's input without the key (the hook adds the stored one). */
export type WriteInput<TOperation extends WriteOperationId> = Omit<Parameters<WriteFunction<TOperation>>[0]["data"], "apiKey">;

export type WriteResult<TOperation extends WriteOperationId> = Awaited<ReturnType<WriteFunction<TOperation>>>;

/** What a successful write makes stale: query key prefixes (every query whose key starts with one is refetched). */
export type Invalidates<TOperation extends WriteOperationId> = ((result: WriteResult<TOperation>, input: WriteInput<TOperation>) => ReadonlyArray<QueryKey>) | ReadonlyArray<QueryKey>;

/** The mutation key of a write (the API inspector lists settled writes by it). */
export const writeMutationKey = (operationId: WriteOperationId) => ["write", operationId] as const;

/**
 * Runs one write through its server function. No optimistic update: on success the listed query keys are refetched
 * (the page shows the server's answer); on error the caller gets the revived `ApiRequestError` (status, code, `param`,
 * `errors[]`, request id) and decides — this hook never toasts, so nothing is said twice. Never retried. Buttons
 * disable themselves while `isPending` (only `createAlert` / A3's `createDestination` take an `Idempotency-Key`).
 */
export function useApiMutation<TOperation extends WriteOperationId>(operationId: TOperation, { invalidates }: { invalidates: Invalidates<TOperation> }) {
    const queryClient = useQueryClient();

    const apiKey = useApiKeyStore(s => s.apiKey);

    return useMutation<WriteResult<TOperation>, Error, WriteInput<TOperation>>({
        mutationFn: (input) => {
            // One table of server functions with different inputs: the entry of `operationId` takes `WriteInput<TOperation>`.
            const run = WRITES[operationId] as unknown as (options: { data: unknown }) => Promise<WriteResult<TOperation>>;

            return run({ data: { ...input, apiKey: apiKey ?? undefined } }).catch(rethrowApiError);
        },
        mutationKey: writeMutationKey(operationId),
        onSuccess: async (result, input) => {
            const keys = typeof invalidates === "function" ? invalidates(result, input) : invalidates;

            await Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
        },
        retry: false,
    });
}

type HeldKey = { body: string; key: string };

/**
 * The `Idempotency-Key` of a create (pure rule): the same body as the held submission keeps its key (a double click, a
 * retry after a lost answer — the API replays the first answer instead of creating twice); another body gets a new key.
 */
export function idempotencyKeyFor(held: HeldKey | null, body: unknown, newKey: () => string): HeldKey {
    const text = JSON.stringify(body);

    return held?.body === text ? held : { body: text, key: newKey() };
}

/**
 * Whether a finished submission ends its key: a success or any API answer (the API decided; a corrected form is a new
 * submission) ends it, a transport failure (no answer: the create may have happened) keeps it for the retry.
 */
export function endsSubmission(error: unknown) {
    return error === null || error instanceof ApiRequestError;
}

/** One key per form submission, held across retries of the same body (`idempotencyKeyFor`, `endsSubmission`). */
export function useIdempotencyKey() {
    const held = React.useRef<HeldKey | null>(null);

    return React.useMemo(() => ({
        /** The key to send with this body. */
        keyFor(body: unknown) {
            held.current = idempotencyKeyFor(held.current, body, () => crypto.randomUUID());

            return held.current.key;
        },
        /** Call when the submission finished: `null` = success, else the error. */
        settle(error: unknown) {
            if (endsSubmission(error)) held.current = null;
        },
    }), []);
}
