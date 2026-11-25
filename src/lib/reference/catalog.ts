import type { StatementType, V2MappingRule } from "@/lib/api/types";

import { isRecord } from "@/lib/guards";

/**
 * The `/catalog` page's model (backend tasks/data-api-dashboard O7 group 7): its tabs, the text filter over the loaded
 * rows and the guards over a mapping rule's free JSON (`rule`: `additionalProperties` in the spec, never cast).
 */

/** The tabs of `/catalog`, one per `/v1/catalog/*` operation (`?tab=`; absent = metrics). */
export const CATALOG_TABS = ["metrics", "sections", "forms", "event-types", "document-kinds", "mapping-rules", "exchanges", "sectors", "macro"] as const;

export type CatalogTab = (typeof CATALOG_TABS)[number];

export const CATALOG_TAB_LABELS: Record<CatalogTab, string> = {
    "document-kinds": "Document kinds",
    "event-types": "Event types",
    "exchanges": "Exchanges",
    "forms": "Forms",
    "macro": "Macro series",
    "mapping-rules": "Mapping rules",
    "metrics": "Metrics",
    "sections": "Sections",
    "sectors": "Sectors",
};

export const STATEMENT_LABELS: Record<StatementType, string> = {
    "balance-sheet": "Balance sheet",
    "cash-flow": "Cash flow",
    "income-statement": "Income statement",
};

/** A metric's statement; the derived metrics (ratios, growth, CAGR, segments) have none. */
export function statementLabel(statement: null | StatementType | undefined) {
    return statement ? STATEMENT_LABELS[statement] : "Derived";
}

/** The unit kinds of `/v1/catalog/metrics` in words; another kind reads as itself. */
const UNIT_LABELS: Record<string, string> = {
    percent: "Percent",
    shares: "Shares",
    usd: "USD",
    usdPerShare: "USD per share",
};

export function unitLabel(unit: null | string | undefined) {
    if (!unit) return "—";

    return UNIT_LABELS[unit] ?? unit;
}

/**
 * The rows a typed filter keeps (pure). A filter equal to a row's id (`metric_id`, `form`, `kind` … — a catalog link
 * from a metric label) keeps exactly those rows; otherwise every word must appear in one of the row's texts
 * (case-insensitive). An empty filter keeps every row.
 */
export function filterCatalogRows<TRow>(rows: ReadonlyArray<TRow>, query: string | undefined, idOf: (row: TRow) => string, textsOf: (row: TRow) => ReadonlyArray<null | string | undefined>): Array<TRow> {
    const q = query?.trim().toLowerCase() ?? "";

    if (!q) return [...rows];

    const exact = rows.filter(row => idOf(row).toLowerCase() === q);

    if (exact.length > 0) return exact;

    const words = q.split(/\s+/);

    return rows.filter((row) => {
        const haystack = [idOf(row), ...textsOf(row)].filter(Boolean).join(" ").toLowerCase();

        return words.every(word => haystack.includes(word));
    });
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** The kinds of a mapping rule in words; another kind reads as itself. */
const RULE_KIND_LABELS: Record<string, string> = {
    alias: "Reported concept",
    formula: "Formula",
    parent_rollup: "Sum of its children",
    period_derivation: "Derived from other periods",
};

const SIGN_POLICY_LABELS: Record<string, string> = {
    as_reported: "As reported",
    cash_flow_credit_balance_negated: "Credit balance negated (cash flow)",
};

export type MappingRuleView = {
    /** `us_gaap:AccountsPayableCurrent (primary)`, the formula, or null. */
    source: null | string;
    kind: string;
    parent: null | string;
    sign: null | string;
};

/** A mapping rule's readable parts (pure; any field of the free JSON may be missing). */
export function mappingRuleView(rule: V2MappingRule["rule"]): MappingRuleView {
    const record: Record<string, unknown> = isRecord(rule) ? rule : {};

    const kind = text(record.kind);

    const alias = text(record.declared_alias);

    const taxonomy = text(record.declared_taxonomy);

    const role = text(record.alias_role);

    const formula = text(record.formula_definition);

    const operands = Array.isArray(record.required_operands) ? record.required_operands.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

    const source = alias
        ? `${taxonomy ? `${taxonomy}:` : ""}${alias}${role ? ` (${role})` : ""}`
        : formula ?? (operands.length > 0 ? operands.join(", ") : null);

    const sign = text(record.sign_policy);

    return {
        kind: kind ? RULE_KIND_LABELS[kind] ?? kind : "—",
        parent: isRecord(record.hierarchy) ? text(record.hierarchy.parent) : null,
        sign: sign ? SIGN_POLICY_LABELS[sign] ?? sign : null,
        source,
    };
}

/**
 * A metric id of `/v1/catalog/metrics` (its families: `is_`, `bs_`, `cfs_` statement metrics, `ratio_`, `growth_`,
 * `cagr_`, `seg_` derived ones): an as-reported concept (`us-gaap:Revenues`, `Revenues`) never is one.
 */
export const CATALOG_METRIC_ID = /^(?:is|bs|cfs|ratio|growth|cagr|seg)_[a-z0-9_]+$/;

export const isCatalogMetricId = (id: null | string | undefined): id is string => typeof id === "string" && CATALOG_METRIC_ID.test(id);
