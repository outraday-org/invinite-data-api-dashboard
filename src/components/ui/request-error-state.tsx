import { ApiRequestError, isTierError } from "@/lib/api/errors";

import { ErrorState } from "./error-state";
import { Notice } from "./notice";

/** A notice's words: an optional badge and the title. */
export type NoticeText = { badge?: string; title: string };

/**
 * THE state of a failed status-aware request (an `ApiRequestError`), checked in this order: the plan gate (`tier`,
 * a 403 `plan_required`) → a known problem `code` (`codes`: the media refusals) → a 404 as `notFound` (only when
 * given; its `title` absent = the API's own words) → a 400 as `badRequest`'s badge with the API's message (only when
 * given) → anything else as `ErrorState` with `title`. Presets: `PeopleState`, `MediaState`; the documents library and
 * the news list pass their options inline.
 */
export function RequestErrorState({
    badRequest,
    codes,
    error,
    notFound,
    tier,
    title,
}: {
    badRequest?: { badge: string };
    codes?: Partial<Record<string, NoticeText>>;
    error: unknown;
    notFound?: { badge?: string; title?: string };
    tier: NoticeText;
    title: string;
}) {
    if (isTierError(error)) return <Notice badge={tier.badge} title={tier.title} />;

    if (error instanceof ApiRequestError) {
        const known = codes?.[error.code];

        if (known) return <Notice badge={known.badge} title={known.title} />;

        if (error.status === 404 && notFound) return <Notice badge={notFound.badge} title={notFound.title ?? error.message} />;

        if (error.status === 400 && badRequest) return <Notice badge={badRequest.badge} title={error.message} />;
    }

    return <ErrorState error={error} title={title} />;
}
