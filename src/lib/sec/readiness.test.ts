import { describe, expect, it } from "vitest";

import { ApiRequestError, fromSerialized } from "@/lib/api/errors";

import { coverageReasonText, isGenuineEmpty, reasonText, secAnswerState, secErrorState } from "./readiness";
import { SEC_LIFECYCLE_NOT_READY_BODY } from "./sec-fixtures";

const secError = (status: number, error: string, code: string) =>
    new ApiRequestError(status, { code, error, message: "m", readiness: { reason: code, status: error } });

describe("secErrorState", () => {
    it.each([
        [403, "excluded", "scope_excluded"],
        [404, "unknown", "version_not_found"],
        [424, "failed", "canonical_object_unreadable"],
        [503, "not_ready", "search_provider_not_registered"],
    ])("%i %s is a readiness state with its reason", (status, state, reason) => {
        expect(secErrorState(secError(status, state, reason))).toMatchObject({ kind: "readiness", reason, status: state });
    });

    it("the REST plan gate (403 Forbidden) is the tier state, not excluded", () => {
        expect(secErrorState(new ApiRequestError(403, { error: "Forbidden", message: "STANDARD" }))).toEqual({ kind: "tier" });
    });

    it("400 refusal, 409 restart_required and 413 too_large are their own states", () => {
        expect(secErrorState(new ApiRequestError(400, { code: "pattern_too_short", error: "Bad Request", message: "short" })))
            .toEqual({ kind: "bad_request", message: "short" });

        expect(secErrorState(new ApiRequestError(409, { code: "stale_cursor", error: "restart_required", message: "x" })).kind)
            .toBe("restart_required");

        expect(secErrorState(new ApiRequestError(413, { error: "too_large", message: "big" })).kind).toBe("too_large");
    });

    it("a transport error stays an error", () => {
        expect(secErrorState(new Error("fetch failed")).kind).toBe("error");
    });

    it("the live 503 lifecycle body survives the server-function boundary with its reason", () => {
        const thrown = new ApiRequestError(503, { error: "not_ready", message: "off" });

        // As TanStack Start revives it: own properties of a plain object, `body` = the live answer.
        const revived = fromSerialized({ body: SEC_LIFECYCLE_NOT_READY_BODY, code: thrown.code, message: "off", status: 503 });

        expect(revived?.reason).toBe("issuer_lifecycle_provider_not_registered");

        expect(secErrorState(revived)).toMatchObject({ reason: "issuer_lifecycle_provider_not_registered", status: "not_ready" });
    });
});

describe("answers and empties", () => {
    it("a ready answer has no state; pending / partial do", () => {
        expect(secAnswerState({ reason: null, status: "ready" })).toBeNull();

        expect(secAnswerState({ reason: "sections_not_projected", status: "pending" })).toMatchObject({ status: "pending" });
    });

    it("no results is genuine only when ready and coverage complete", () => {
        expect(isGenuineEmpty({ status: "ready" })).toBe(true);

        expect(isGenuineEmpty({ status: "ready" }, { completeness: "partial" })).toBe(false);

        expect(isGenuineEmpty({ status: "partial" })).toBe(false);

        expect(isGenuineEmpty({ status: "pending" }, { completeness: "complete" })).toBe(false);
    });

    it("reason texts: known words, unknown codes readable, SEC coverage reasons + generic fallback", () => {
        expect(reasonText("search_provider_not_registered")).toBe("SEC filing search is not switched on yet");

        expect(reasonText("issuer_excluded:abs_form")).toBe("issuer excluded: abs form");

        expect(coverageReasonText("held_gap")).toMatch(/gaps/);

        expect(coverageReasonText("brand_new_reason")).toBe("Results may be incomplete");
    });
});
