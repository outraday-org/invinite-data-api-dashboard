import { toast } from "sonner";
import { z } from "zod";

import type { TranscriptFormat } from "@/lib/earnings/transcript";

import { DOCUMENT_SORT_VALUES } from "@/lib/earnings/documents";
import { formatMs } from "@/lib/earnings/format";
import { optionalEnum, optionalFlag, optionalInt } from "@/lib/url-state";

/**
 * Every tab of the call page, in bar order (`?tab=`; the route's `validateSearch` reads this list). No Audio tab since
 * O2: the player sits above every tab, and an old `?tab=audio` falls back to the transcript.
 */
export const CALL_TAB_VALUES = [
    "transcript",
    "slides",
    "press-release",
    "documents",
    "guidance",
    "non-gaap",
    "kpi-series",
    "qa",
    "participants",
    "metrics",
    "prosody",
    "price-moves",
] as const;

export type CallTab = (typeof CALL_TAB_VALUES)[number];

export const DEFAULT_CALL_TAB: CallTab = "transcript";

/** The Transcript tab's formats in the URL (`?format=`); Speakers is the default and never written. */
export const TRANSCRIPT_FORMAT_VALUES = ["speakers", "sections", "cleaned", "text"] as const satisfies ReadonlyArray<TranscriptFormat>;

export const DEFAULT_TRANSCRIPT_FORMAT: TranscriptFormat = "speakers";

/** The longest call a `?t=` may point into (12 h; a longer value falls back to no time). */
const MAX_CALL_SECONDS = 12 * 60 * 60;

/**
 * The call page's URL state (O6-final): `tab`, the Transcript tab's `format` and published `version` (absent = the
 * current one), and `t` = a moment of the call in whole seconds (the player's "Copy link at current time"); O7 group 5
 * adds the Metrics & diff tab's `prior` and the Documents tab's `docSort`. Every field
 * is optional (every `EventLink` stays search-free) and an invalid value falls back to its default.
 */
export const callSearchSchema = z.object({
    /** Documents tab: the list order (`sort` of `/v1/investor-documents`; absent = the API's `-filing_date`). */
    docSort: optionalEnum(DOCUMENT_SORT_VALUES),
    format: optionalEnum(TRANSCRIPT_FORMAT_VALUES),
    /** Metrics & diff: the `prior` call of `/comparison` (absent = the derived previous call). */
    play: optionalFlag(),
    prior: z.uuid().optional().catch(undefined),
    /** Slides tab: the 1-based page selected in the presentation viewer. */
    slide: optionalInt(1, 100_000),
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

/**
 * "Copy link at current time": writes `?t=` into the address bar FIRST (through `onSearchChange`, so a browser without
 * clipboard access — no secure context, a denied permission — still has the link there), then copies the link.
 */
export async function copyCallLinkAt(seconds: number, onSearchChange: (patch: Partial<CallSearch>) => void): Promise<void> {
    const link = callLinkAt(window.location.href, seconds);

    onSearchChange({ t: Math.max(0, Math.floor(seconds)) });

    try {
        await navigator.clipboard.writeText(link);

        toast.success(`Link at ${formatMs(Math.floor(seconds) * 1000)} copied`);
    }
    catch {
        toast.error("Could not copy the link — it is in the address bar");
    }
}
