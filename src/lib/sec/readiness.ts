/**
 * The readiness / error states of the SEC views, classified once (`/v1/filings*`, `/v1/filers*`, holdings, insider
 * trades, IPOs, document versions, filing search). A 200 carries `meta.coverage.state` (`pending` with `data: []`,
 * `partial`, `complete`) — `v2CoverageState` —, and the refusals are problems: 403 `excluded`, 404 `not_covered`,
 * 503 `unavailable` (`V2_PROBLEM_STATUS`), 400 refusals and 409 / 413; the REST plan gate is 403 `plan_required`.
 * None of these is an empty result: "no results" is only a complete answer (and, for search, complete coverage).
 */
import type { SecReadinessStatus, SecSearchCoverage, V2MetaCoverage } from "@/lib/api/types";

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

/**
 * The v2 problem codes of the SEC family as readiness states: 403 `excluded` keeps its name, 404 `not_covered` = not
 * known to the store, 503 `unavailable` = an outage or a provider switched off (the problem's `detail` says which).
 */
export const V2_PROBLEM_STATUS: Readonly<Partial<Record<string, SecReadinessStatus>>> = {
    excluded: "excluded",
    not_covered: "unknown",
    unavailable: "not_ready",
};

/** The state of a failed SEC request (an `ApiRequestError` revived by the hooks). */
export function secErrorState(error: unknown): SecState {
    if (isTierError(error)) return { kind: "tier" };

    if (!(error instanceof ApiRequestError)) return { error, kind: "error" };

    const status = error.body.readiness?.status ?? V2_PROBLEM_STATUS[error.code] ?? error.code;

    if (isReadinessStatus(status)) {
        return { kind: "readiness", message: error.message, reason: error.reason ?? error.body.readiness?.reason ?? null, status };
    }

    if (error.code === "restart_required" || error.status === 409) return { kind: "restart_required", message: error.message };

    if (error.code === "too_large" || error.status === 413) return { kind: "too_large", message: error.message };

    if (error.status === 400) return { kind: "bad_request", message: error.message };

    return { error, kind: "error" };
}

/**
 * The state of a v2 200 by its `meta.coverage`: `pending` (the store is still filling this scope; `data` is empty) and
 * `partial` (more rows are coming) are states, `complete` / no coverage = render the rows as they are (null).
 */
export function v2CoverageState(coverage: null | Pick<V2MetaCoverage, "state" | "through"> | undefined): null | SecState {
    if (!coverage || coverage.state === "complete") return null;

    const through = coverage.through ? `Complete through ${coverage.through}` : null;

    return { kind: "readiness", message: through, reason: null, status: coverage.state };
}

/** A v2 list's "no rows" is genuine only when its coverage is complete (or not stated). */
export function isV2GenuineEmpty(coverage: null | Pick<V2MetaCoverage, "state"> | undefined) {
    return !coverage || coverage.state === "complete";
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

/** A search's "no results" is genuine only for a complete page coverage AND a complete index (`meta.index`). */
export function isSearchGenuineEmpty(
    coverage: null | Pick<V2MetaCoverage, "state"> | undefined,
    index: null | Pick<SecSearchCoverage, "completeness"> | undefined,
) {
    return isV2GenuineEmpty(coverage) && index?.completeness === "complete";
}
