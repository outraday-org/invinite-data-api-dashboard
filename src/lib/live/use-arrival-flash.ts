import { useEffect, useRef, useState } from "react";

/** How long a newly arrived row flashes (`.row-arrive` in `styles.css`: the keyframes last as long). */
export const ARRIVAL_FLASH_MS = 2500;

/**
 * The rows that just arrived over a live feed and flash (`/filings`; meant for the news lists too). A row with an
 * arrival instant younger than `ARRIVAL_FLASH_MS` flashes once, for the rest of that time, when it is first seen while
 * `ready` (the prefill settled: a frame received before it arrived "with" the list and does not flash) and `enabled`
 * (the feed is on). Rows without an arrival (a REST refetch) never flash. One timer per arrival, never an interval;
 * the row stays in the list.
 */
export function useArrivalFlash<TRow>(rows: ReadonlyArray<TRow>, options: {
    arrivedAt: (row: TRow) => null | string;
    enabled: boolean;
    idOf: (row: TRow) => string;
    ready: boolean;
}): ReadonlySet<string> {
    const { arrivedAt, enabled, idOf, ready } = options;

    // A null expiry records an arrival seen while paused or before the prefill settled.
    const [expiries, setExpiries] = useState<ReadonlyMap<string, null | number>>(() => new Map());

    const [now, setNow] = useState(() => Date.now());

    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    let updated: Map<string, null | number> | undefined;

    for (const row of rows) {
        const at = arrivedAt(row);

        const id = idOf(row);

        if (at === null || expiries.has(id)) continue;

        updated ??= new Map(expiries);

        const expiry = Date.parse(at) + ARRIVAL_FLASH_MS;

        updated.set(id, ready && enabled && expiry > Date.now() ? expiry : null);
    }

    if (updated) setExpiries(updated);

    const flashing = new Set<string>();

    for (const [id, expiry] of updated ?? expiries) {
        if (expiry !== null && expiry > now) flashing.add(id);
    }

    useEffect(() => {
        for (const [id, expiry] of expiries) {
            if (expiry === null || timers.current.has(id)) continue;

            timers.current.set(id, setTimeout(() => {
                setNow(Date.now());
            }, Math.max(0, expiry - Date.now())));
        }
    }, [expiries]);

    useEffect(() => {
        const pending = timers.current;

        return () => {
            for (const timer of pending.values()) clearTimeout(timer);

            pending.clear();
        };
    }, []);

    return flashing;
}
