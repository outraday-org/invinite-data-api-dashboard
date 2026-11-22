import type {
    V2Fund,
    V2FundCompositionReason,
    V2FundSource,
    V2FundStoredDate,
    V2FundWeight,
    V2FundWeightDimension,
    V2FundWeightsResponse,
    V2HolderSectionState,
    V2HolderSource,
} from "@/lib/api/types";

import { formatDay } from "@/lib/format";
import { formatNumberEn } from "@/lib/utils";

/**
 * View helpers of a listed fund's composition (`/v1/funds/{fund}/holdings` + `/weights`) and of the holders of a
 * security (`/v1/holders`, Data API 7.0). Every value of the contract's enums has its label here (`fund.test.ts` reads
 * the enums from `openapi.json`, so a new value cannot ship unlabelled).
 */

export const FUND_SOURCE_LABELS: Record<V2FundSource, string> = {
    issuer_daily: "Issuer file",
    issuer_monthly: "Issuer file (monthly)",
    nport: "SEC N-PORT filing",
};

/** "Issuer file · as of Nov 13, 2026": the label every composition carries (never "current" or "live"). */
export function fundSourceText(source: null | undefined | V2FundSource, asOf: null | string | undefined): null | string {
    if (!source || !asOf) return null;

    return `${FUND_SOURCE_LABELS[source]} · as of ${formatDay(asOf)}`;
}

export const FUND_REASON_TEXT: Record<V2FundCompositionReason, string> = {
    issuer_source_unavailable: "The issuer's holdings file is not available; this is the fund's latest N-PORT report.",
    no_composition: "No composition is stored for this fund yet.",
    single_asset_trust: "This fund holds one asset; there is no holdings list.",
    source_stale: "The issuer's holdings file is more than 5 trading days old.",
    weights_unavailable: "No weights for this composition.",
};

/** The sentence for `meta.reason` (an answer partial or empty by design), or null. */
export function fundReasonText(reason: null | undefined | V2FundCompositionReason): null | string {
    return reason ? FUND_REASON_TEXT[reason] : null;
}

/**
 * The as-of picker's days: the stored compositions the API serves (`ready`, or no status for an N-PORT report), newest
 * first, each with its source label; quarantined / superseded issuer files are left out.
 */
export function fundPickerDays(stored: null | ReadonlyArray<V2FundStoredDate> | undefined): Array<{ label: string; value: string }> {
    return (stored ?? [])
        .filter(entry => entry.status == null || entry.status === "ready")
        .map(entry => ({ label: `${entry.as_of} · ${FUND_SOURCE_LABELS[entry.source]}`, value: entry.as_of }));
}

export const FUND_DIMENSION_LABELS: Record<V2FundWeightDimension, string> = {
    asset_class: "Asset class",
    country: "Country",
    sector: "Sector",
};

const BASIS_LABELS: Record<string, string> = {
    derived_sic: "derived from SEC industry codes",
    isin_prefix: "derived from ISIN prefixes",
    issuer_stated: "as stated by the issuer",
    mixed: "partly derived",
    none: "not classified",
    nport: "from the N-PORT filing",
    registrant: "derived from the issuer's SEC registration",
};

/** One basis in plain words ("derived from SEC industry codes"); an unknown basis stays as its code. */
export function fundBasisText(basis: string): string {
    return BASIS_LABELS[basis] ?? basis.replaceAll("_", " ");
}

/** The short tag of a position's sector / country basis beside the value ("SIC", "ISIN"); none for `none`. */
export const POSITION_BASIS_TAGS: Readonly<Record<string, string>> = {
    derived_sic: "SIC",
    isin_prefix: "ISIN",
    issuer_stated: "issuer",
    nport: "N-PORT",
    registrant: "registration",
};

export const WEIGHT_BASIS_TEXT: Record<NonNullable<V2FundWeightsResponse["meta"]["weight_basis"]>, string> = {
    issuer_stated: "each weight as stated in the issuer file",
    net_assets: "market value over the stated net assets",
    none: "no weight was stated or derivable",
    nport: "the N-PORT percent of net assets",
    sum: "market value over the sum of the non-derivative positions",
};

/**
 * "Each dimension sums to 100.02 % (each weight as stated in the issuer file)"; a leveraged / inverse fund is far from
 * 100 (derivatives at notional), said so. null without a sum.
 */
export function weightSumText(meta: Pick<V2FundWeightsResponse["meta"], "weight_basis" | "weight_pct_sum"> | undefined): null | string {
    const sum = meta?.weight_pct_sum;

    if (sum == null || !Number.isFinite(sum)) return null;

    const basis = meta?.weight_basis ? ` (${WEIGHT_BASIS_TEXT[meta.weight_basis]})` : "";

    const far = Math.abs(sum - 100) > 5 ? " — far from 100 %: derivatives count at their notional exposure" : "";

    return `Each dimension sums to ${formatNumberEn(sum, { maximumFractionDigits: 2 })} %${basis}${far}.`;
}

/** The legend note of a dimension's buckets: their bases in plain words (several = joined). */
export function fundBasisNote(weights: ReadonlyArray<V2FundWeight>): null | string {
    const bases = [...new Set(weights.map(weight => weight.basis))];

    if (bases.length === 0) return null;

    return bases.map(fundBasisText).join(", ");
}

/** The buckets per dimension in the API's order (sector, country, asset class), largest first within each. */
export function fundWeightsByDimension(
    weights: ReadonlyArray<V2FundWeight>,
): Array<{ dimension: V2FundWeightDimension; weights: Array<V2FundWeight> }> {
    const order: Array<V2FundWeightDimension> = ["sector", "country", "asset_class"];

    return order
        .map(dimension => ({
            dimension,
            weights: weights.filter(weight => weight.dimension === dimension).sort((left, right) => right.weight_pct - left.weight_pct),
        }))
        .filter(group => group.weights.length > 0);
}

/** Net assets with their scope: `series` = the whole series, all its share classes (VOO), never one class's. */
export function netAssetsScopeText(scope: V2Fund["net_assets_scope"]): null | string {
    if (scope === "series") return "series total, all share classes";

    if (scope === "fund") return "this fund";

    return null;
}

// Holders (`/v1/holders`, owner decision 12): three sources, never merged.

/** The tab / section title of each holder source. */
export const HOLDER_SOURCE_LABELS: Record<V2HolderSource, string> = {
    "13f": "Institutions (13F)",
    "issuer_file": "ETFs (issuer files)",
    "nport": "Funds (N-PORT)",
};

/** What each source is, in one line (the overview's section subtitle). */
export const HOLDER_SOURCE_NOTES: Record<V2HolderSource, string> = {
    "13f": "Managers' quarterly 13F reports, by quarter end.",
    "issuer_file": "ETFs' own daily / monthly holdings files — only the ETFs with an issuer file, not every ETF.",
    "nport": "Funds' public N-PORT reports, each fund's latest report.",
};

export const HOLDER_SECTION_STATE_LABELS: Record<V2HolderSectionState, string> = {
    complete: "Complete",
    not_covered: "Not covered",
    partial: "Partial",
    pending: "Being prepared",
    unavailable: "Unavailable",
};

/** The store's reasons of an empty / partial holder source; another reason is shown as its code in words. */
const HOLDER_REASON_TEXT: Record<string, string> = {
    coverage_partial: "Not every report of this source is loaded yet, so the list may be incomplete.",
    etn_cusip_unknown: "The note's own CUSIP is not known yet, so its holders cannot be told apart from its issuing bank's other notes.",
    fund_cusip_unknown: "The fund's own CUSIP is not known yet, so its holders cannot be told apart from its trust's other funds.",
    fund_not_linked: "The fund is not linked to its SEC series yet.",
    no_etf_holders: "No ETF with an issuer holdings file holds this security.",
    upstream_unavailable: "This source is temporarily unavailable; try again later.",
};

/** A holders reason (`meta.reason`, `meta.sections[].reason`; the spec types it as text) in words, else the code with spaces. */
export function holderReasonText(reason: null | string | undefined): null | string {
    if (!reason) return null;

    return HOLDER_REASON_TEXT[reason] ?? reason.replaceAll("_", " ");
}
