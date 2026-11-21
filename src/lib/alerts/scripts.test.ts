import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SCRIPT_V1_ERROR, SCRIPT_V2_OK } from "./alerts-fixtures";
import {
    alertIdsInDetail,
    canAddVersion,
    defaultText,
    diagnosticsByLine,
    diagnosticsSummary,
    inputRangeText,
    manifestInputs,
    SCRIPT_DESCRIPTION_MAX,
    SCRIPT_NAME_MAX,
    SCRIPT_SOURCE_MAX,
    scriptUploadErrors,
    sourceProblem,
    versionsNewestFirst,
} from "./scripts";

type Schema = { maxLength?: number; properties?: Record<string, Schema> };

const spec = JSON.parse(readFileSync("openapi.json", "utf8")) as { paths: Record<string, { post: { requestBody: { content: { "application/json": { schema: Schema } } } } }> };

const bodyOf = (path: string) => spec.paths[path].post.requestBody.content["application/json"].schema.properties!;

describe("upload bounds", () => {
    it("are the spec's (both creates)", () => {
        expect(bodyOf("/v1/scripts").source.maxLength).toBe(SCRIPT_SOURCE_MAX);

        expect(bodyOf("/v1/scripts/{id}/versions").source.maxLength).toBe(SCRIPT_SOURCE_MAX);

        expect(bodyOf("/v1/scripts").name.maxLength).toBe(SCRIPT_NAME_MAX);

        expect(bodyOf("/v1/scripts").description.maxLength).toBe(SCRIPT_DESCRIPTION_MAX);
    });

    it("a source above 204 800 characters is refused before upload; exactly the limit passes", () => {
        expect(sourceProblem("x".repeat(SCRIPT_SOURCE_MAX))).toBeNull();

        expect(sourceProblem("x".repeat(SCRIPT_SOURCE_MAX + 1))).toBe("The source has 204,801 characters; at most 204,800 can be uploaded.");

        expect(sourceProblem("  \n")).toBe("The source is empty.");

        expect(scriptUploadErrors({ description: "", name: "", source: "x".repeat(SCRIPT_SOURCE_MAX + 1) }, { needsName: true })).toEqual({
            name: "A name is required.",
            source: expect.stringContaining("at most 204,800") as string,
        });

        expect(scriptUploadErrors({ source: "x" }, { needsName: false })).toEqual({});
    });

    it("the 20-version limit", () => {
        expect(canAddVersion({ version_count: 19 })).toBe(true);

        expect(canAddVersion({ version_count: 20 })).toBe(false);
    });
});

describe("versions", () => {
    it("the manifest's declared inputs (chartlang defaultValue / title; null manifest = none)", () => {
        expect(manifestInputs(SCRIPT_V2_OK.manifest)).toEqual([
            { default: 9, kind: "int", max: 200, min: 1, name: "fast", options: undefined, step: undefined, title: "fast" },
            { default: 21, kind: "int", max: 500, min: 2, name: "slow", options: undefined, step: undefined, title: "Slow length" },
        ]);

        expect(manifestInputs(null)).toEqual([]);

        expect(manifestInputs({ inputs: [1, 2] })).toEqual([]);

        expect(manifestInputs({ inputs: { mode: { default: "a", kind: "enum", options: ["a", "b"] } } })[0]).toMatchObject({ default: "a", options: ["a", "b"], title: "mode" });
    });

    it("bounds, options and defaults in words", () => {
        expect(inputRangeText({ max: 200, min: 1 })).toBe("1–200");

        expect(inputRangeText({ min: 2 })).toBe("≥ 2");

        expect(inputRangeText({ options: ["up", "down"] })).toBe("up, down");

        expect(inputRangeText({})).toBe("");

        expect(defaultText(true)).toBe("true");

        expect(defaultText(undefined)).toBe("—");
    });

    it("diagnostics by line and in one line; versions newest first", () => {
        expect([...diagnosticsByLine(SCRIPT_V1_ERROR.diagnostics).keys()]).toEqual([6, 9]);

        expect(diagnosticsSummary(SCRIPT_V1_ERROR.diagnostics)).toBe("1 error, 1 warning");

        expect(diagnosticsSummary([])).toBe("No diagnostics");

        expect(versionsNewestFirst([SCRIPT_V1_ERROR, SCRIPT_V2_OK]).map(version => version.version)).toEqual([2, 1]);
    });

    it("the alert ids a 409 names", () => {
        expect(alertIdsInDetail("The script is used by alerts alt_01JD2Q5Z8K3M7N9P4R6T1V0W2X, alt_2 and more")).toEqual(["alt_01JD2Q5Z8K3M7N9P4R6T1V0W2X", "alt_2"]);

        expect(alertIdsInDetail("The script is used by alert alt_9")).toEqual(["alt_9"]);

        expect(alertIdsInDetail("conflict")).toEqual([]);
    });
});
