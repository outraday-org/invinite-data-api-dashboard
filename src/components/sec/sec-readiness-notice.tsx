import type { SecReadinessStatus, V2MetaCoverage } from "@/lib/api/types";
import type { SecState } from "@/lib/sec/readiness";

import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { READINESS_TEXT, reasonText, secAnswerState, secErrorState, v2CoverageState } from "@/lib/sec/readiness";

/** Per-view words for a state (e.g. search's 503 not_ready = "SEC filing search is not switched on yet"). */
export type SecStateTitles = Partial<Record<SecReadinessStatus, string>>;

function SecStateNotice({ state, title, titles }: { state: SecState; title: string; titles?: SecStateTitles }) {
    switch (state.kind) {
        case "bad_request":
            return <Notice badge="Invalid request" title={state.message} />;
        case "error":
            return <ErrorState error={state.error} title={title} />;
        case "readiness": {
            const text = READINESS_TEXT[state.status];

            const heading = titles?.[state.status] ?? text.title;

            const detail = reasonText(state.reason) ?? state.message;

            // The detail line only when it adds something to the title.
            return <Notice badge={text.badge} title={heading}>{detail && detail !== heading ? detail : undefined}</Notice>;
        }
        case "restart_required":
            return <Notice badge="Start over" title="The results changed since the first page — run it again" />;
        case "tier":
            return <Notice badge="STANDARD" title="Your plan does not include the SEC document store" />;
        case "too_large":
            return <Notice badge="Too large" title={state.message} />;
    }
}

/**
 * The honest state of an SEC request — never an empty result: a failed request (`error`: v1 403 excluded / 404 unknown
 * / 424 failed / 503 not_ready / 400 / 409 / 413, v2 403 `excluded` / 404 `not_covered` / 503 `unavailable`, plan gate),
 * a non-ready v1 answer (`readiness`: 202 pending, 200 partial) or a v2 200's `coverage` (`meta.coverage`: pending /
 * partial). Renders nothing for a ready / complete answer.
 */
export function SecReadinessNotice({
    coverage,
    error,
    readiness,
    title = "Failed to load from the SEC store",
    titles,
}: {
    coverage?: null | Pick<V2MetaCoverage, "state" | "through">;
    error?: unknown;
    readiness?: null | { reason: null | string; status: SecReadinessStatus };
    title?: string;
    titles?: SecStateTitles;
}) {
    const state = error ? secErrorState(error) : readiness ? secAnswerState(readiness) : v2CoverageState(coverage);

    if (!state) return null;

    return <SecStateNotice state={state} title={title} titles={titles} />;
}
