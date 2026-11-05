/**
 * The readiness / error states of `/v1/sec/*`, classified once for every SEC view. The API answers 200 ready /
 * partial, 202 pending (the route body), 403 excluded / 404 unknown / 424 failed / 503 not_ready (`SecStoreError`),
 * 400 refusals, 409 `restart_required` (a stale cursor) and 413 `too_large`; the REST plan gate is `403 Forbidden`.
 * None of these is an empty result: "no results" is only a ready answer (and, for search, complete coverage).
 */
import type { SecReadinessStatus, SecSearchCoverage } from "@/lib/api/types";

import { ApiRequestError, isTierError } from "@/lib/api/errors";

export const SEC_READINESS_STATUSES = [
    "ready",
    "partial",
    "pending",
    "excluded",
    "unknown",
    "failed",
    "not_ready",
] as const satisfies ReadonlyArray<SecReadinessStatus>;

const STATE_STATUSES: ReadonlySet<string> = new Set<string>(SEC_READINESS_STATUSES);

function isReadinessStatus(value: string): value is SecReadinessStatus {
    return STATE_STATUSES.has(value);
}

export type SecState
    = | { kind: "bad_request"; message: string }
        | { kind: "error"; error: unknown }
        | { kind: "readiness"; message: null | string; reason: null | string; status: SecReadinessStatus }
        | { kind: "restart_required"; message: string }
        | { kind: "tier" }
        | { kind: "too_large"; message: string };

/** The state of a failed `/v1/sec/*` request (an `ApiRequestError` revived by the hooks). */
export function secErrorState(error: unknown): SecState {
    if (isTierError(error)) return { kind: "tier" };

    if (!(error instanceof ApiRequestError)) return { error, kind: "error" };

    const status = error.body.readiness?.status ?? error.code;

    if (isReadinessStatus(status)) {
        return { kind: "readiness", message: error.message, reason: error.reason ?? error.body.readiness?.reason ?? null, status };
    }

    if (error.code === "restart_required" || error.status === 409) return { kind: "restart_required", message: error.message };

    if (error.code === "too_large" || error.status === 413) return { kind: "too_large", message: error.message };

    if (error.status === 400) return { kind: "bad_request", message: error.message };

    return { error, kind: "error" };
}

/** The state of an answer that arrived (200 / 202): null when it is `ready` (render the body as is). */
export function secAnswerState(readiness: { reason: null | string; status: SecReadinessStatus }): null | SecState {
    if (readiness.status === "ready") return null;

    return { kind: "readiness", message: null, reason: readiness.reason, status: readiness.status };
}

export const READINESS_TEXT: Record<SecReadinessStatus, { badge: string; title: string }> = {
    excluded: { badge: "Excluded", title: "Outside the SEC store's coverage" },
    failed: { badge: "Failed", title: "The SEC store could not process this" },
    not_ready: { badge: "Not switched on", title: "This SEC capability is not switched on yet" },
    partial: { badge: "Partial", title: "Partly available — what is shown may be incomplete" },
    pending: { badge: "Pending", title: "Being prepared — asked again in 30 s" },
    ready: { badge: "Ready", title: "Ready" },
    unknown: { badge: "Unknown", title: "Not known to the SEC store" },
};

// Reasons with their own words; any other reason is shown as its code in plain words (`reasonText`).
const REASON_TEXT: Partial<Record<string, string>> = {
    documents_not_held: "The filer's documents are not held yet",
    image_not_public: "The image has no public copy yet",
    issuer_lifecycle_provider_not_registered: "Issuer lifecycle is not switched on yet",
    lifecycle_evidence_pending: "Some lifecycle evidence is still being processed",
    lifecycle_not_reduced: "The lifecycle evidence is not reduced yet",
    no_market_evidence: "No market evidence for this filer yet (needs review)",
    search_provider_not_registered: "SEC filing search is not switched on yet",
    sec_store_not_configured: "The SEC store is not connected to this API",
    sections_not_projected: "The section outline is not built yet",
    upstream_unavailable: "The SEC store is temporarily unavailable",
};

/** A reason code in words: a known reason's text, else the code with spaces ("held_gap" → "held gap"). */
export function reasonText(reason: null | string): null | string {
    if (!reason) return null;

    return REASON_TEXT[reason] ?? reason.replaceAll("_", " ").replaceAll(":", ": ");
}

const COVERAGE_REASON_TEXT: Partial<Record<string, string>> = {
    candidate_cap_reached: "Too many candidate passages — narrow the query",
    coverage_unavailable: "Search coverage could not be checked — results may be incomplete",
    documents_not_held: "Some of the filer's documents are not held yet — results may be incomplete",
    form_not_indexed: "Some forms are not in the search index (by policy)",
    held_gap: "The held filing history has gaps — results may be incomplete",
    held_not_verified: "The held filing history is not verified yet — results may be incomplete",
    lexical_backfill_pending: "Search index is still being built for this company — results may be incomplete",
    no_forms_indexed: "No form of this scope is in the search index yet",
    not_held: "Some documents are not held yet — results may be incomplete",
    not_projected: "Some documents are not indexed yet — results may be incomplete",
    not_published: "Some documents are not published yet — results may be incomplete",
    older_than_index_window: "Filings older than the index window are not searched",
    projection_failed: "Some passages could not be indexed — results may be incomplete",
    scan_budget_reached: "The search stopped at its scan budget — results may be incomplete",
    scope_excluded: "Part of the scope is outside the SEC store's coverage",
    scope_needs_review: "Part of the scope awaits review — results may be incomplete",
    scope_not_current: "The scope changed while searching — results may be incomplete",
    search_projection_empty: "Nothing of this scope is indexed yet",
    search_provider_not_registered: "SEC filing search is not switched on yet",
    search_timeout: "The search timed out — results may be incomplete",
};

/** One line per coverage reason (earnings and SEC vocabularies); an unknown reason gets the generic line. */
export function coverageReasonText(reason: string) {
    return COVERAGE_REASON_TEXT[reason] ?? "Results may be incomplete";
}

/** "No results" is genuine only for a ready answer whose coverage (if any) is complete. */
export function isGenuineEmpty(readiness: { status: SecReadinessStatus }, coverage?: null | Pick<SecSearchCoverage, "completeness">) {
    return readiness.status === "ready" && (!coverage || coverage.completeness === "complete");
}
