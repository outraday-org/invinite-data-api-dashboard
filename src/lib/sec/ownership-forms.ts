/**
 * Ownership forms (Data API 11.5, tag Ownership; the `/ownership-filings` page): Schedule 13D / 13G filings
 * (`/v1/beneficial-ownership`) and Form 144 notices of a proposed sale (`/v1/insider-sale-notices`). Pure helpers: the
 * page's requests from its URL state, the chain markers, the percent of class in words.
 */
import type { V2BeneficialOwnershipFiling, V2BeneficialOwnershipType, V2InsiderSaleNotice } from "@/lib/api/types";

import { formatNumber } from "@/lib/format";
import { parseCikList } from "@/lib/sec/ownership";
import { orderedWindow } from "@/lib/url-state";

/** Rows per page of either list (the API allows up to 200). */
export const OWNERSHIP_FORMS_PAGE = 50;

/** The page's tabs: Schedule 13D / 13G (default) and Form 144. */
export const OWNERSHIP_FORM_TABS = ["schedule-13", "form-144"] as const;

export type OwnershipFormTab = (typeof OWNERSHIP_FORM_TABS)[number];

/** The URL state both requests read (`?company=&filer=&owner=&type=&chain=&from=&to=`). */
export type OwnershipFormsSearch = {
    /** "full" = the whole amendment chain (`current=false`); absent = latest filing only (the API's default). */
    chain?: "full";
    /** Tickers / CIKs, comma-joined (`CompanyFilter`). */
    company?: string;
    /** Reporting-person CIKs as typed (13D / 13G). */
    filer?: string;
    /** Filed days (`YYYY-MM-DD`), inclusive. */
    from?: string;
    /** Seller CIKs as typed (Form 144). */
    owner?: string;
    to?: string;
    type?: V2BeneficialOwnershipType;
};

/** The schedule in words: 13D = activist (may seek to influence the company), 13G = passive. */
export const SCHEDULE_LABELS: Record<V2BeneficialOwnershipFiling["schedule"], string> = {
    "13D": "13D · activist",
    "13G": "13G · passive",
};

/** A CIK list as typed → the API's comma list (digits only, ≤ 50, de-duplicated); nothing valid = undefined. */
export const cikListParam = (text: string | undefined) => parseCikList(text)?.join(",");

/**
 * `/v1/beneficial-ownership` for a URL state: the company list and / or the filer CIKs (null when neither is named — the
 * API needs one, so no request is sent), the type, `current=false` for the full chain, the filed days in order.
 */
export function beneficialOwnershipRequest(search: OwnershipFormsSearch) {
    const filer = cikListParam(search.filer);

    if (!search.company && !filer) return null;

    const { from, to } = orderedWindow({ from: search.from, to: search.to });

    return {
        company: search.company,
        current: search.chain === "full" ? false : undefined,
        filer,
        from,
        limit: OWNERSHIP_FORMS_PAGE,
        to,
        type: search.type,
    };
}

/** `/v1/insider-sale-notices` for a URL state: the company list and / or the seller CIKs (null when neither is named). */
export function insiderSaleNoticesRequest(search: OwnershipFormsSearch) {
    const owner = cikListParam(search.owner);

    if (!search.company && !owner) return null;

    const { from, to } = orderedWindow({ from: search.from, to: search.to });

    return { company: search.company, from, limit: OWNERSHIP_FORMS_PAGE, owner, to };
}

/** The percent of class as filed (7.5 = 7.5 %) → "7.5%"; not stated = "—". */
export function percentOfClassText(value: null | number | undefined): string {
    return value == null ? "—" : `${formatNumber(value, { maximumFractionDigits: 2 })}%`;
}

/** Where a 13D / 13G filing stands in its amendment chain: the latest state or superseded, and what it amends. */
export function chainStatus(filing: Pick<V2BeneficialOwnershipFiling, "is_current" | "supersedes_accession">) {
    return {
        label: filing.is_current ? "Latest" : "Superseded",
        supersedes: filing.supersedes_accession ?? null,
    };
}

/** A Form 144 notice's amendment links in words: "Replaces <accession>" (an amendment) and "Replaced by <accession>". */
export function noticeChainMarkers(notice: Pick<V2InsiderSaleNotice, "replaced_by" | "replaces_accession">): Array<{ accession: string; kind: "replaced_by" | "replaces"; text: string }> {
    const markers: Array<{ accession: string; kind: "replaced_by" | "replaces"; text: string }> = [];

    if (notice.replaces_accession) markers.push({ accession: notice.replaces_accession, kind: "replaces", text: `Replaces ${notice.replaces_accession}` });

    if (notice.replaced_by) markers.push({ accession: notice.replaced_by, kind: "replaced_by", text: `Replaced by ${notice.replaced_by}` });

    return markers;
}

/** The note on a row whose values are null because no structured document was read (`parse_state`). */
export const PARSE_STATE_NOTES: Record<V2BeneficialOwnershipFiling["parse_state"], null | string> = {
    failed: "The filing's form could not be read: open it on EDGAR",
    no_structured_document: "No structured form filed: open it on EDGAR",
    parsed: null,
};
