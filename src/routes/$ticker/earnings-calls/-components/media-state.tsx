import type { NoticeText } from "@/components/ui/request-error-state";
import type { OperationId } from "@/lib/api/operations.gen";

import { tierLabel } from "@/components/ui/credit-hint";
import { Notice } from "@/components/ui/notice";
import { RequestErrorState } from "@/components/ui/request-error-state";

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
export const MEDIA_CODES: Partial<Record<string, NoticeText>> = {
    // One answer for an unlicensed company and a recording not served yet (not marked, failed, too long).
    forbidden: {
        badge: "Unavailable",
        title: "Audio for this call is not available (not licensed for delivery, or the recording is not ready yet)",
    },
    unavailable: { badge: "Unavailable", title: "Media temporarily unavailable" },
};

/** The plan-gate notice of an operation: the plan its `x-tier` names (the generated operations table), never a typed one. */
export function mediaTierText(operationId: OperationId): NoticeText {
    const label = tierLabel(operationId) ?? "Plan";

    return { badge: label, title: `${label} plan required` };
}

/**
 * The state of a status-aware earnings request (`ApiRequestError`): a known media code or the REST plan gate as a
 * `Notice`, a 404 as `notFound` when given, anything else as `ErrorState` (`RequestErrorState` with the media options).
 * `operationId` is the request whose error this is: its plan names the plan-gate notice.
 */
export function MediaState({ error, notFound, operationId, title }: {
    error: unknown;
    notFound?: string;
    operationId: OperationId;
    title: string;
}) {
    return (
        <RequestErrorState
            codes={MEDIA_CODES}
            error={error}
            notFound={notFound ? { title: notFound } : undefined}
            tier={mediaTierText(operationId)}
            title={title}
        />
    );
}
