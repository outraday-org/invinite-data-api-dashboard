import { formatMetricId } from "@/lib/utils";

import type {
    AsReportedPresentationFactRaw,
    PresentationFact,
    StandardizedPresentationFactRaw,
    TreeRow,
} from "./types";

export function buildTreeRows(
    facts: Array<PresentationFact>,
    depth: number,
    parentId: null | string,
    out: Array<Omit<TreeRow, "values">>,
) {
    for (const fact of facts) {
        const children = fact.children ?? [];

        out.push({
            depth,
            hasChildren: children.length > 0,
            isTotal: fact.type === "as-reported" ? Boolean(fact.is_total) : false,
            label: getFactLabel(fact),
            metricId: getFactId(fact),
            parentId,
        });

        if (children.length > 0) {
            buildTreeRows(children, depth + 1, getFactId(fact), out);
        }
    }
}

/** Keep the latest full report's hierarchy, then supplement it with every loaded period's missing rows. */
export function mergedTreeRows(periods: ReadonlyArray<{ facts: Array<PresentationFact>; preliminary?: boolean }>): Array<Omit<TreeRow, "values">> {
    // A release can promote a metric to root when its parent is absent. Prefer a full report for the hierarchy.
    const baseline = periods.find(period => !period.preliminary && period.facts.length > 0);

    const ordered = baseline ? [baseline, ...periods.filter(period => period !== baseline)] : periods;

    const byId = new Map<string, Omit<TreeRow, "values">>();

    for (const period of ordered) {
        const rows: Array<Omit<TreeRow, "values">> = [];

        buildTreeRows(period.facts, 0, null, rows);

        for (const row of rows) {
            if (!byId.has(row.metricId)) byId.set(row.metricId, row);
        }
    }

    const children = new Map<null | string, Array<Omit<TreeRow, "values">>>();

    for (const row of byId.values()) {
        const siblings = children.get(row.parentId) ?? [];

        siblings.push(row);

        children.set(row.parentId, siblings);
    }

    const out: Array<Omit<TreeRow, "values">> = [];

    const visit = (parentId: null | string, depth: number) => {
        for (const row of children.get(parentId) ?? []) {
            out.push({ ...row, depth, hasChildren: children.has(row.metricId) });

            visit(row.metricId, depth + 1);
        }
    };

    visit(null, 0);

    return out;
}

export function flattenToValueMap(
    facts: Array<PresentationFact>,
    out: Map<string, null | number>,
) {
    for (const fact of facts) {
        out.set(getFactId(fact), fact.value ?? null);

        if (fact.children?.length) {
            flattenToValueMap(fact.children, out);
        }
    }
}

export function addFactTypes(
    facts: ReadonlyArray<AsReportedPresentationFactRaw | StandardizedPresentationFactRaw>,
): Array<PresentationFact> {
    return facts.map((fact) => {
        if ("metric_id" in fact) {
            const children = fact.children ? addFactTypes(fact.children) : undefined;

            return {
                ...fact,
                children,
                type: "standardized",
            };
        }

        const children = fact.children ? addFactTypes(fact.children) : undefined;

        return {
            ...fact,
            children,
            type: "as-reported",
        };
    });
}

export function getFactId(fact: PresentationFact) {
    return fact.type === "standardized" ? fact.metric_id : fact.concept;
}

export function getFactLabel(fact: PresentationFact) {
    if (fact.type === "standardized") return formatMetricId(fact.metric_id);

    return fact.label || fact.concept;
}
