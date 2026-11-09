import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { ApiRequestError, isTierError } from "@/lib/api/errors";

// Lifted to `src/components/ui/notice.tsx` (the SEC views use it too); re-exported for the existing importers.
export { Notice };

export const NO_TRANSCRIPT_TITLE = "No transcript yet";

// Capture statuses that end a call without a recording (`capture_status` is a plain string on the event).
const NO_RECORDING_STATUSES = new Set(["expired", "missed"]);

/** The state of a transcript-derived tab of an event without a transcript (`has_transcript: false`). */
export function NoTranscriptNotice({ captureStatus }: { captureStatus: string }) {
    const reason = NO_RECORDING_STATUSES.has(captureStatus)
        ? "No recording was captured."
        : "The call has not been transcribed.";

    return <Notice title={NO_TRANSCRIPT_TITLE}>{reason}</Notice>;
}

// The answers IDA's v2 media operations give by design (`code` = the problem's `code`). The REST plan gate is a 403
// `plan_required` (`isTierError`, checked first), so a 403 `forbidden` here is the audio refusal.
const MEDIA_CODES: Partial<Record<string, { badge: string; title: string }>> = {
    // One answer for an unlicensed company and a recording not served yet (not marked, failed, too long).
    forbidden: {
        badge: "Unavailable",
        title: "Audio for this call is not available (not licensed for delivery, or the recording is not ready yet)",
    },
    unavailable: { badge: "Unavailable", title: "Media temporarily unavailable" },
};

/**
 * The state of a status-aware earnings request (`ApiRequestError`): a known media code or the
 * REST plan gate as a `Notice`, a 404 as `notFound` when given, anything else as `ErrorState`.
 */
export function MediaState({ error, notFound, title }: { error: unknown; notFound?: string; title: string }) {
    if (isTierError(error)) return <Notice badge="PRO" title="PRO plan required" />;

    if (error instanceof ApiRequestError) {
        const known = MEDIA_CODES[error.code];

        if (known) return <Notice badge={known.badge} title={known.title} />;

        if (error.status === 404 && notFound) return <Notice title={notFound} />;
    }

    return <ErrorState error={error} title={title} />;
}
