import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { OPERATION_IDS_BY_ROUTE, OPERATIONS, PLAN_ORDER } from "./operations.gen";

type SpecOperation = { "operationId": string; "x-credits"?: number; "x-tier"?: string };

const spec = JSON.parse(readFileSync(resolve(__dirname, "../../../openapi.json"), "utf8")) as {
    paths: Record<string, Record<string, SpecOperation>>;
};

const specOperations = Object.entries(spec.paths).flatMap(([path, item]) =>
    Object.entries(item)
        .filter(([method]) => ["delete", "get", "patch", "post", "put"].includes(method))
        .map(([method, operation]) => ({ method: method.toUpperCase(), operation, path })));

describe("operations.gen.ts (pnpm generate:api)", () => {
    it("has one entry per operation of openapi.json (139)", () => {
        expect(specOperations).toHaveLength(139);

        expect(Object.keys(OPERATIONS)).toHaveLength(specOperations.length);
    });

    it("carries each operation's method, path, credits and tier as the spec states them", () => {
        for (const { method, operation, path } of specOperations) {
            const entry = OPERATIONS[operation.operationId as keyof typeof OPERATIONS];

            expect(entry.method).toBe(method);

            expect(entry.path).toBe(path);

            expect(entry.credits).toBe(operation["x-credits"] ?? null);

            expect(entry.tier).toBe(operation["x-tier"] ?? null);

            expect(OPERATION_IDS_BY_ROUTE[`${method} ${path}`]).toBe(operation.operationId);
        }
    });

    it("links each operation's docs page and orders the route tiers as /v1/me orders its plans", () => {
        expect(OPERATIONS.getFund.docsUrl).toBe("https://data.invinite.com/docs/get--_v1_funds_{fund}");

        expect(PLAN_ORDER).toEqual(["free", "lite", "standard", "pro", "enterprise"]);
    });

    it("PLAN_ORDER is /v1/me's plan enum minus the plans no x-tier names (payg is an account plan, not a rung)", () => {
        const contract = JSON.parse(readFileSync(resolve(__dirname, "../../../openapi.json"), "utf8")) as {
            components: { schemas: { Me: { properties: { plan: { enum: Array<string> } } } } };
        };

        const plans = contract.components.schemas.Me.properties.plan.enum;

        expect(plans).toContain("payg");

        expect(PLAN_ORDER).toEqual(plans.filter(plan => plan !== "payg"));
    });
});
