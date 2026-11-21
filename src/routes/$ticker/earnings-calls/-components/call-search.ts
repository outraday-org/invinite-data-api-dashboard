import { z } from "zod";

import type { TranscriptFormat } from "@/lib/earnings/transcript";

import { optionalEnum, optionalInt } from "@/lib/url-state";

import { CALL_TAB_VALUES } from "./call-tabs";

/** The Transcript tab's formats in the URL (`?format=`); Speakers is the default and never written. */
export const TRANSCRIPT_FORMAT_VALUES = ["speakers", "sections", "cleaned", "text"] as const satisfies ReadonlyArray<TranscriptFormat>;

export const DEFAULT_TRANSCRIPT_FORMAT: TranscriptFormat = "speakers";

/** The longest call a `?t=` may point into (12 h; a longer value falls back to no time). */
const MAX_CALL_SECONDS = 12 * 60 * 60;

/**
 * The call page's URL state (O6-final): `tab`, the Transcript tab's `format` and published `version` (absent = the
 * current one), and `t` = a moment of the call in whole seconds (the player's "Copy link at current time"). Every field
 * is optional (every `EventLink` stays search-free) and an invalid value falls back to its default.
 */
export const callSearchSchema = z.object({
    format: optionalEnum(TRANSCRIPT_FORMAT_VALUES),
    t: optionalInt(0, MAX_CALL_SECONDS),
    tab: optionalEnum(CALL_TAB_VALUES),
    version: optionalInt(1, 100_000),
});

export type CallSearch = z.infer<typeof callSearchSchema>;

/** `href` with `?t=<seconds>` (other params kept): the link "Copy link at current time" copies. */
export function callLinkAt(href: string, seconds: number): string {
    const url = new URL(href);

    url.searchParams.set("t", String(Math.max(0, Math.floor(seconds))));

    return url.toString();
}
