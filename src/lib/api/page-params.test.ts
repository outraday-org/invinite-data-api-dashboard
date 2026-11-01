import { describe, expect, it } from "vitest";

import { firstPageParam, offsetOfNextUrl, offsetPageParam } from "./page-params";

describe("offsetPageParam (the earnings lists' default, unchanged)", () => {
    it("reads the offset of next_url", () => {
        expect(offsetPageParam({ next_url: "https://api.data.invinite.com/v1/earnings-calls/calendar?limit=50&offset=100" })).toBe(100);

        expect(offsetPageParam({ next_url: "/v1/earnings-calls/events?identifier=NVDA&offset=200" })).toBe(200);
    });

    it("ends the list without a next_url, a zero / missing / bad offset", () => {
        expect(offsetPageParam({ next_url: null })).toBeUndefined();

        expect(offsetPageParam({})).toBeUndefined();

        expect(offsetOfNextUrl("/v1/x?offset=0")).toBeUndefined();

        expect(offsetOfNextUrl("/v1/x?limit=5")).toBeUndefined();

        expect(offsetOfNextUrl("/v1/x?offset=abc")).toBeUndefined();
    });
});

describe("firstPageParam", () => {
    it("keeps a cursor list's null: the first /v1/news request never sends cursor 0", () => {
        expect(firstPageParam<null | string>(null)).toBeNull();
    });

    it("defaults an offset list to 0", () => {
        expect(firstPageParam<number>(undefined)).toBe(0);
    });
});
