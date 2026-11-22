import { z } from "zod";

/**
 * URL state (O6): every filter, tab, sort and open item of a page is a search param, validated by the route's
 * `validateSearch` (each field optional + `.catch(undefined)`: an invalid value falls back to the default, never an
 * error page) and written with `IN_PLACE` (no history entry per keystroke / pick, no scroll jump). A default value is
 * written as `undefined`, so a page's plain URL is its default view.
 */

/** The navigate options of a search change that filters or opens something in place. */
export const IN_PLACE = { replace: true, resetScroll: false } as const;

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD`. */
export const optionalDay = () => z.string().regex(DAY_PATTERN).optional().catch(undefined);

/**
 * A trimmed text of `min` (default 1) to `max` characters; anything else reads as absent. The router reads a bare
 * numeric value as a number (`?form=144`, `?company=320193`: JSON search values), so a finite number is read as its text.
 */
export const optionalText = (max = 100, min = 1) => z
    .preprocess(value => (typeof value === "number" && Number.isFinite(value) ? String(value) : value), z.string().trim().min(min).max(max))
    .optional()
    .catch(undefined);

/** One of `values`. */
export const optionalEnum = <const T extends readonly [string, ...Array<string>]>(values: T) => z.enum(values).optional().catch(undefined);

/** An SEC accession number (`0000320193-24-000123`). */
export const optionalAccession = () => z.string().regex(/^\d{10}-\d{2}-\d{6}$/).optional().catch(undefined);

/** A boolean flag written as `true` (absent = false). */
export const optionalFlag = () => z.boolean().optional().catch(undefined);

/** A whole number in `[min, max]` (`?t=95`, `?version=3`; a numeric string is read as its number). */
export const optionalInt = (min: number, max: number) => z.coerce.number().int().min(min).max(max).optional().catch(undefined);
