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

// The answers IDA's media routes give by design (`code` = the body's `error`).
const MEDIA_CODES: Partial<Record<string, { badge: string; title: string }>> = {
    audio_disabled: {
        badge: "Not enabled",
        title: "Audio delivery is not enabled on the API yet (PRO; per-customer watermarked copies — coming)",
    },
    audio_unavailable: {
        badge: "Unavailable",
        title: "Audio for this company is not available under the current licence",
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
