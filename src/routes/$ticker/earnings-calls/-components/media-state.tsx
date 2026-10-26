import type * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { ApiRequestError, isTierError } from "@/lib/api/errors";

/** A muted, non-error card: an expected state ("not enabled", "not available", "coming soon"). */
export function Notice({ badge, children, title }: { badge?: string; children?: React.ReactNode; title: string }) {
    return (
        <Card className="border-muted-foreground/20" role="status" size="sm">
            <CardHeader className="gap-2">
                <div className="flex items-center gap-2">
                    {badge && <Badge variant="outline">{badge}</Badge>}
                    <CardTitle className="text-sm">{title}</CardTitle>
                </div>
            </CardHeader>
            {children && <CardContent className="text-muted-foreground">{children}</CardContent>}
        </Card>
    );
}

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

// The answers IDA's media routes give by design (`code` = the body's `error`).
const MEDIA_CODES: Partial<Record<string, { badge: string; title: string }>> = {
    // One answer for an unlicensed company and a recording not served yet (not marked, failed, too long).
    audio_unavailable: {
        badge: "Unavailable",
        title: "Audio for this call is not available (not licensed for delivery, or the recording is not ready yet)",
    },
    media_unavailable: { badge: "Unavailable", title: "Media temporarily unavailable" },
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
