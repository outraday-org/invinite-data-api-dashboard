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

    const [flashing, setFlashing] = useState<ReadonlySet<string>>(() => new Set());

    // Arrivals already handled (flashed, or seen before `ready`): each flashes at most once.
    const seen = useRef(new Set<string>());

    const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

    useEffect(() => {
        const schedule = (delay: number, run: () => void) => {
            const timer = setTimeout(() => {
                timers.current.delete(timer);

                run();
            }, delay);

            timers.current.add(timer);
        };

        const now = Date.now();

        for (const row of rows) {
            const at = arrivedAt(row);

            if (at === null) continue;

            const id = idOf(row);

            if (seen.current.has(id)) continue;

            seen.current.add(id);

            const left = ARRIVAL_FLASH_MS - (now - Date.parse(at));

            if (!ready || !enabled || !(left > 0)) continue;

            // Set from timer callbacks (never in the effect body): on, on the next tick; off, when its time is up.
            schedule(0, () => setFlashing(current => new Set([id, ...current])));

            schedule(left, () => setFlashing((current) => {
                const next = new Set(current);

                next.delete(id);

                return next;
            }));
        }
    }, [arrivedAt, enabled, idOf, ready, rows]);

    useEffect(() => {
        const pending = timers.current;

        return () => {
            for (const timer of pending) clearTimeout(timer);
        };
    }, []);

    return flashing;
}
