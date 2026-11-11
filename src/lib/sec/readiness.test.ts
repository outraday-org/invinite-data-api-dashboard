import { describe, expect, it } from "vitest";

import { ApiRequestError } from "@/lib/api/errors";

import { coverageReasonText, isSearchGenuineEmpty, isV2GenuineEmpty, reasonText, secErrorState, v2CoverageState } from "./readiness";

describe("secErrorState", () => {
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
});

describe("answers and empties", () => {
    it("a search's no results is genuine only with a complete page AND a complete index", () => {
        expect(isSearchGenuineEmpty({ state: "complete" }, { completeness: "complete" })).toBe(true);

        expect(isSearchGenuineEmpty(undefined, { completeness: "complete" })).toBe(true);

        expect(isSearchGenuineEmpty({ state: "complete" }, { completeness: "partial" })).toBe(false);

        expect(isSearchGenuineEmpty({ state: "partial" }, { completeness: "complete" })).toBe(false);

        expect(isSearchGenuineEmpty({ state: "complete" }, null)).toBe(false);
    });

    it("reason texts: known words, unknown codes readable, SEC coverage reasons + generic fallback", () => {
        expect(reasonText("search_provider_not_registered")).toBe("SEC filing search is not switched on yet");

        expect(reasonText("issuer_excluded:abs_form")).toBe("issuer excluded: abs form");

        expect(coverageReasonText("held_gap")).toMatch(/gaps/);

        expect(coverageReasonText("brand_new_reason")).toBe("Results may be incomplete");
    });
});

describe("meta.coverage on a 200, problems for refusals", () => {
    it("pending and partial are states (with `through` as the detail); complete or no coverage render the rows", () => {
        expect(v2CoverageState({ state: "pending" })).toEqual({ kind: "readiness", message: null, reason: null, status: "pending" });

        expect(v2CoverageState({ state: "partial", through: "2026-09-30" }))
            .toEqual({ kind: "readiness", message: "Complete through 2026-09-30", reason: null, status: "partial" });

        expect(v2CoverageState({ state: "complete", through: "2026-09-30" })).toBeNull();

        expect(v2CoverageState(undefined)).toBeNull();
    });

    it("an empty v2 list is genuine only with complete (or unstated) coverage", () => {
        expect(isV2GenuineEmpty({ state: "complete" })).toBe(true);

        expect(isV2GenuineEmpty(undefined)).toBe(true);

        expect(isV2GenuineEmpty({ state: "pending" })).toBe(false);

        expect(isV2GenuineEmpty({ state: "partial" })).toBe(false);
    });

    // Problems as `ApiRequestError` reads them: `error` = the problem `code`, `message` = `detail`.
    const problem = (status: number, code: string, detail: string) => new ApiRequestError(status, { error: code, message: detail, requestId: "req_1" });

    it.each([
        [403, "excluded", "excluded"],
        [404, "not_covered", "unknown"],
        [503, "unavailable", "not_ready"],
    ])("%i %s is the %s readiness state, the problem detail its message", (status, code, state) => {
        expect(secErrorState(problem(status, code, "detail words"))).toEqual({ kind: "readiness", message: "detail words", reason: null, status: state });
    });

    it("the plan gate (403 plan_required) is the tier state; a 400 problem is a refusal", () => {
        expect(secErrorState(problem(403, "plan_required", "PRO"))).toEqual({ kind: "tier" });

        expect(secErrorState(problem(400, "unknown_parameter", "Unknown parameter: offset"))).toEqual({ kind: "bad_request", message: "Unknown parameter: offset" });
    });
});
