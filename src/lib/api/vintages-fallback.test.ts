import { describe, expect, it, vi } from "vitest";

import { readWithInstantFallback } from "./vintages-fallback";

type Answer = { error?: unknown; response: { status: number }; tag: string };

const ok = (tag: string): Answer => ({ response: { status: 200 }, tag });

const notFound: Answer = { error: { code: "not_found" }, response: { status: 404 }, tag: "404" };

describe("readWithInstantFallback (Filed values)", () => {
    it("asks again by the end alone when a start matched no instant (404)", async () => {
        const read = vi.fn((start: string | undefined) => Promise.resolve(start === undefined ? ok("by end") : notFound));

        await expect(readWithInstantFallback(read, "2026-07-01", undefined)).resolves.toMatchObject({ tag: "by end" });

        expect(read.mock.calls).toEqual([["2026-07-01"], [undefined]]);
    });

    it("keeps one request when the start matched, when there was none, on a continuation page and on another error", async () => {
        const matched = vi.fn(() => Promise.resolve(ok("duration")));

        await expect(readWithInstantFallback(matched, "2026-07-01", undefined)).resolves.toMatchObject({ tag: "duration" });

        const noStart = vi.fn(() => Promise.resolve(notFound));

        await expect(readWithInstantFallback(noStart, undefined, undefined)).resolves.toBe(notFound);

        const continuation = vi.fn(() => Promise.resolve(notFound));

        await expect(readWithInstantFallback(continuation, "2026-07-01", "c1")).resolves.toBe(notFound);

        const unavailable: Answer = { error: { code: "unavailable" }, response: { status: 503 }, tag: "503" };

        const outage = vi.fn(() => Promise.resolve(unavailable));

        await expect(readWithInstantFallback(outage, "2026-07-01", undefined)).resolves.toBe(unavailable);

        for (const read of [matched, noStart, continuation, outage]) expect(read).toHaveBeenCalledTimes(1);
    });
});
