/**
 * Type guards over free JSON / unknown values, one copy for every reader (the alert views and form, scripts,
 * catalog mapping rules, transcripts, follow-along). `src/lib/sec/source.ts` keeps its own `JsonValue`-typed
 * `isRecord` for the SEC view models.
 */

/** A plain object (not null, not an array); `TValue` = what its values are taken to be (default `unknown`). */
export function isRecord<TValue = unknown>(value: unknown): value is Record<string, TValue> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
