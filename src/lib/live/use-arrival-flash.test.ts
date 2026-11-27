import { act, cleanup, renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ARRIVAL_FLASH_MS, useArrivalFlash } from "./use-arrival-flash";

const css = readFileSync("src/styles.css", "utf8");

describe(".row-arrive (styles.css)", () => {
    const rule = /\.row-arrive\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

    it("lasts as long as ARRIVAL_FLASH_MS, once, and has NO fill mode: after it ends the row's hover fill applies again", () => {
        expect(rule).toContain(`filing-arrive ${ARRIVAL_FLASH_MS / 1000}s ease-out 1`);

        expect(rule).not.toMatch(/forwards|backwards|both/);
    });

    it("flickers in the primary colour, then fades to transparent; a static tint with reduced motion", () => {
        const keyframes = /@keyframes filing-arrive\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";

        expect(keyframes).toMatch(/0%\s*\{ background-color: color-mix\(in oklch, var\(--primary\) 35%, transparent\)/);

        expect(keyframes).toMatch(/100% \{ background-color: transparent; \}/);

        expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.row-arrive\s*\{\s*animation: none;\s*background-color: color-mix\(in oklch, var\(--primary\) 15%, transparent\);/);
    });
});

type Arrival = { at: null | string; id: string };

const options = { arrivedAt: (row: Arrival) => row.at, enabled: true, idOf: (row: Arrival) => row.id, ready: true };

afterEach(() => {
    cleanup();

    vi.useRealTimers();
});

it("uses one expiry timer per arrival and clears all timers on unmount", () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-11-27T10:00:00Z"));

    const arrivals = ["a", "b", "c"].map(id => ({ at: new Date().toISOString(), id }));

    const { rerender, result, unmount } = renderHook(({ rows }) => useArrivalFlash(rows, options), { initialProps: { rows: arrivals.slice(0, 1) } });

    expect(result.current.has("a")).toBe(true);

    expect(vi.getTimerCount()).toBe(1);

    rerender({ rows: arrivals });

    expect(vi.getTimerCount()).toBe(3);

    act(() => vi.advanceTimersByTime(ARRIVAL_FLASH_MS));

    expect(result.current.size).toBe(0);

    expect(vi.getTimerCount()).toBe(0);

    rerender({ rows: [...arrivals, { at: new Date().toISOString(), id: "d" }] });

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
});

it("never flashes old, pre-ready or paused arrivals later; REST-only rows remain eligible", () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-11-27T10:00:00Z"));

    const fresh = { at: new Date().toISOString(), id: "fresh" };

    const old = { at: "2026-11-27T09:59:00Z", id: "old" };

    const { rerender, result } = renderHook(({ enabled, ready, rows }) => useArrivalFlash(rows, { ...options, enabled, ready }), {
        initialProps: { enabled: true, ready: false, rows: [fresh, old, { at: null, id: "rest" }] as Array<Arrival> },
    });

    rerender({ enabled: true, ready: true, rows: [fresh, old, { at: new Date().toISOString(), id: "rest" }] });

    expect([...result.current]).toEqual(["rest"]);

    expect(vi.getTimerCount()).toBe(1);

    rerender({ enabled: false, ready: true, rows: [fresh, old, { ...fresh, id: "paused" }] });

    rerender({ enabled: true, ready: true, rows: [fresh, old, { ...fresh, id: "paused" }] });

    expect(result.current.has("paused")).toBe(false);
});
