import { describe, expect, it, vi } from "vitest";

import { ME_PRO } from "@/lib/account-fixtures";

import { ApiRequestError } from "./errors";
import { isMeQueryKey, keyStateOf } from "./queries";

// Keep the server functions (TanStack Start) unloaded.
vi.mock("./server-functions", () => ({}));

const unauthorized = new ApiRequestError(401, { error: "invalid_api_key", message: "The key was refused." });

const base = { data: null, error: null, hasHydrated: true, isLoading: false };

describe("keyStateOf (the key gate's state from `/v1/me`)", () => {
    it("checking until the store is hydrated and `/v1/me` answered", () => {
        expect(keyStateOf({ ...base, hasHydrated: false }).state).toBe("checking");

        expect(keyStateOf({ ...base, isLoading: true }).state).toBe("checking");
    });

    it("ready with an answer; invalid on a 401; unavailable on any other failure", () => {
        expect(keyStateOf({ ...base, data: ME_PRO })).toEqual({ me: ME_PRO, state: "ready" });

        expect(keyStateOf({ ...base, error: unauthorized })).toEqual({ me: null, state: "invalid" });

        expect(keyStateOf({ ...base, error: new ApiRequestError(503, { error: "unavailable", message: "Down." }) }).state).toBe("unavailable");
    });

    it("a key revoked mid-session: the refused refetch wins over the cached answer (the onboarding card shows)", () => {
        expect(keyStateOf({ ...base, data: ME_PRO, error: unauthorized })).toEqual({ me: null, state: "invalid" });
    });

    it("a failed refetch for another reason keeps the cached answer (the pages stay)", () => {
        expect(keyStateOf({ ...base, data: ME_PRO, error: new Error("network") })).toEqual({ me: ME_PRO, state: "ready" });
    });
});

describe("isMeQueryKey (a 401 elsewhere asks `/v1/me` again)", () => {
    it("matches useMe's key only, not the usage query", () => {
        expect(isMeQueryKey(["v2", "me", "123"])).toBe(true);

        expect(isMeQueryKey(["v2", "me", "usage", 30, "123"])).toBe(false);

        expect(isMeQueryKey(["v2", "filers", "x", "123"])).toBe(false);
    });
});
