import { describe, expect, it } from "vitest";

import { OPERATIONS } from "@/lib/api/operations.gen";
import { API_FAMILIES, API_FAMILY_OPERATIONS, apiFamilyOf } from "@/lib/navigation";

const operationIds = Object.keys(OPERATIONS) as Array<keyof typeof OPERATIONS>;

describe("API_FAMILIES (the landing page's coverage list)", () => {
    it("places every HTTP operation of the operations table in exactly one family", () => {
        const unplaced = operationIds.filter(id => apiFamilyOf(OPERATIONS[id].path) === null);

        expect(unplaced).toEqual([]);

        const counted = Object.values(API_FAMILY_OPERATIONS).flat();

        expect(counted).toHaveLength(operationIds.length);

        expect(new Set(counted).size).toBe(operationIds.length);
    });

    it("lists no prefix twice and none that matches no operation", () => {
        const prefixes = API_FAMILIES.flatMap(family => family.prefixes);

        expect(new Set(prefixes).size).toBe(prefixes.length);

        const dead = prefixes.filter(prefix => !operationIds.some((id) => {
            const path = OPERATIONS[id].path;

            return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}:`);
        }));

        expect(dead).toEqual([]);
    });

    it("gives every family an operation; the longest prefix wins; the WebSocket is not counted", () => {
        expect(API_FAMILIES.filter(family => API_FAMILY_OPERATIONS[family.id].length === 0)).toEqual([]);

        expect(apiFamilyOf("/v1/filers/{cik}/holdings")?.id).toBe("ownership");

        expect(apiFamilyOf("/v1/filers/{cik}")?.id).toBe("filings");

        expect(apiFamilyOf("/v1/beneficial-ownership")?.id).toBe("ownership");

        expect(apiFamilyOf("/v1/insider-sale-notices")?.id).toBe("ownership");

        expect(apiFamilyOf("/v1/me/alert-user-defaults")?.id).toBe("alerts");

        expect(apiFamilyOf("/v1/alerts:batch")?.id).toBe("alerts");

        expect(operationIds).not.toContain("streamEvents");
    });

    it("ids are unique", () => {
        expect(new Set(API_FAMILIES.map(family => family.id)).size).toBe(API_FAMILIES.length);
    });
});
