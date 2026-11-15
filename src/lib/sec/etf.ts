import type {
    V2EtfHoldingsResponse,
    V2EtfSource,
    V2EtfStoredDate,
    V2EtfWeight,
    V2EtfWeightDimension,
} from "@/lib/api/types";

/** View helpers of the ETF composition (Data API release 5.10, `/v1/etf-holdings` + `/v1/etf-weights`). */

export const ETF_SOURCE_LABELS: Record<V2EtfSource, string> = {
    issuer_daily: "Issuer file",
    issuer_monthly: "Issuer file (monthly)",
    nport: "SEC N-PORT filing",
};

/** "Issuer file · as of 2026-11-13": the label every composition carries (never "current" or "live"). */
export function etfSourceText(source: null | undefined | V2EtfSource, asOf: null | string | undefined): null | string {
    if (!source || !asOf) return null;

    return `${ETF_SOURCE_LABELS[source]} · as of ${asOf}`;
}

type EtfReason = NonNullable<V2EtfHoldingsResponse["meta"]["reason"]>;

const REASON_TEXT: Record<EtfReason, string> = {
    issuer_source_unavailable: "The issuer's holdings file is not available; this is the fund's latest N-PORT report.",
    single_asset_trust: "This fund holds one asset; there is no holdings list.",
    source_stale: "The issuer's holdings file is more than 5 trading days old.",
    weights_unavailable: "No weights for this composition.",
};

/** The sentence for `meta.reason` (an answer partial or empty by design), or null. */
export function etfReasonText(reason: EtfReason | null | undefined): null | string {
    return reason ? REASON_TEXT[reason] : null;
}

/**
 * The as-of picker's days: the stored compositions the API serves (`ready`, or no status for an N-PORT report), newest
 * first, each with its source label; quarantined / superseded issuer files are left out.
 */
export function etfPickerDays(stored: null | ReadonlyArray<V2EtfStoredDate> | undefined): Array<{ label: string; value: string }> {
    return (stored ?? [])
        .filter(entry => entry.status == null || entry.status === "ready")
        .map(entry => ({ label: `${entry.as_of} · ${ETF_SOURCE_LABELS[entry.source]}`, value: entry.as_of }));
}

export const ETF_DIMENSION_LABELS: Record<V2EtfWeightDimension, string> = {
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

/** The legend note of a dimension's buckets: their bases in plain words (several = joined). */
export function etfBasisNote(weights: ReadonlyArray<V2EtfWeight>): null | string {
    const bases = [...new Set(weights.map(weight => weight.basis))];

    if (bases.length === 0) return null;

    return bases.map(basis => BASIS_LABELS[basis] ?? basis).join(", ");
}

/** The buckets per dimension in the API's order (sector, country, asset class), largest first within each. */
export function etfWeightsByDimension(
    weights: ReadonlyArray<V2EtfWeight>,
): Array<{ dimension: V2EtfWeightDimension; weights: Array<V2EtfWeight> }> {
    const order: Array<V2EtfWeightDimension> = ["sector", "country", "asset_class"];

    return order
        .map(dimension => ({
            dimension,
            weights: weights.filter(weight => weight.dimension === dimension).sort((left, right) => right.weight_pct - left.weight_pct),
        }))
        .filter(group => group.weights.length > 0);
}
