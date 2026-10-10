/**
 * In-process memo of the public `/status*` responses. The server functions run on Netlify, where
 * every visitor shares ONE IDA ingress client: the memo keeps the status pages under the status
 * class budget however many people open them. Errors are never cached; concurrent callers of one
 * key share a single in-flight promise.
 */
type MemoEntry<T> = {
    expiresAt: number;
    value: Promise<T>;
};

export type Memoize<T> = ((key: string, ttlMs: number, fetcher: () => Promise<T>, now?: () => number) => Promise<T>) & {
    /** Entries currently held (expired ones included until the next insert). */
    size: () => number;
};

/**
 * A memo with its own module-level cache (one per response type keeps the cache typed). Every insert
 * first evicts the expired entries, so keys that are never asked again (e.g. unknown vendors) cannot
 * grow the map beyond what one TTL's worth of distinct keys holds.
 */
export function createMemo<T>(): Memoize<T> {
    const cache = new Map<string, MemoEntry<T>>();

    const evictExpired = (at: number) => {
        for (const [key, entry] of cache) {
            if (entry.expiresAt <= at) cache.delete(key);
        }
    };

    const memoize = (key: string, ttlMs: number, fetcher: () => Promise<T>, now: () => number = Date.now) => {
        const at = now();

        const current = cache.get(key);

        if (current && current.expiresAt > at) return current.value;

        evictExpired(at);

        const value = fetcher();

        const entry: MemoEntry<T> = { expiresAt: at + ttlMs, value };

        cache.set(key, entry);

        value.catch(() => {
            // Only drop our own entry: a newer fetch may already have replaced it.
            if (cache.get(key) === entry) cache.delete(key);
        });

        return value;
    };

    return Object.assign(memoize, { size: () => cache.size });
}

/** Five minutes: the status pages are refreshed by browsers / CDNs at the same cadence. */
export const PUBLIC_STATUS_TTL_MS = 5 * 60 * 1000;
