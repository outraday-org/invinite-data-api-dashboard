import { describe, expect, it, vi } from "vitest";

import { createMemo, PUBLIC_STATUS_TTL_MS } from "./public-memo";

describe("createMemo", () => {
    it("fetches once for two calls within the TTL", async () => {
        const memoize = createMemo<number>();

        const fetcher = vi.fn(() => Promise.resolve(1));

        let time = 1_000;

        const now = () => time;

        await expect(memoize("30|all", PUBLIC_STATUS_TTL_MS, fetcher, now)).resolves.toBe(1);

        time += PUBLIC_STATUS_TTL_MS - 1;

        await expect(memoize("30|all", PUBLIC_STATUS_TTL_MS, fetcher, now)).resolves.toBe(1);

        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("refetches after the TTL expired", async () => {
        const memoize = createMemo<number>();

        const fetcher = vi.fn()
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(2);

        let time = 0;

        const now = () => time;

        await memoize("k", 300_000, fetcher, now);

        time = 300_000;

        await expect(memoize("k", 300_000, fetcher, now)).resolves.toBe(2);

        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("keys entries separately", async () => {
        const memoize = createMemo<string>();

        const fetcher = vi.fn((value: string) => Promise.resolve(value));

        await memoize("7|", 1_000, () => fetcher("a"));

        await memoize("30|", 1_000, () => fetcher("b"));

        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("never caches a rejected fetch", async () => {
        const memoize = createMemo<number>();

        const fetcher = vi.fn()
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce(3);

        await expect(memoize("k", 300_000, fetcher)).rejects.toThrow("boom");

        await expect(memoize("k", 300_000, fetcher)).resolves.toBe(3);

        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("shares one in-flight promise between concurrent callers", async () => {
        const memoize = createMemo<number>();

        let resolve: (value: number) => void = () => {};

        const fetcher = vi.fn(() => new Promise<number>((r) => {
            resolve = r;
        }));

        const first = memoize("k", 300_000, fetcher);

        const second = memoize("k", 300_000, fetcher);

        resolve(4);

        await expect(Promise.all([first, second])).resolves.toEqual([4, 4]);

        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("evicts expired entries on insert, so unknown keys cannot grow the map", async () => {
        const memoize = createMemo<number>();

        let time = 0;

        const now = () => time;

        for (const vendor of ["a", "b", "c"]) await memoize(vendor, 1_000, () => Promise.resolve(1), now);

        expect(memoize.size()).toBe(3);

        time = 1_000;

        await memoize("d", 1_000, () => Promise.resolve(2), now);

        expect(memoize.size()).toBe(1);
    });
});
