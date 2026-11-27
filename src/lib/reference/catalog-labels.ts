import * as React from "react";

import type { V2NewsKindCatalogEntry } from "@/lib/api/types";

import { useDividendTypeCatalogInfinite, useHaltReasonCatalogInfinite, useNewsKindCatalogInfinite } from "@/lib/api/queries";
import { useAutoLoadPages } from "@/lib/api/use-auto-load-pages";

/** Catalog-backed views keep the stored value visible before a name is available. */
export const rawCatalogLabel = (value: string): string => value;

export const RAW_NEWS_CATALOG_LABELS = {
    developmentTopicLabel: rawCatalogLabel,
    kindLabel: rawCatalogLabel,
    topicLabel: rawCatalogLabel,
};

export type NewsCatalogLabels = typeof RAW_NEWS_CATALOG_LABELS;

type CatalogQuery = {
    fetchNextPage: (options: { cancelRefetch: boolean }) => unknown;
    hasNextPage: boolean;
    isFetching: boolean;
    isFetchNextPageError: boolean;
};

/** Multiple mounted consumers share the in-flight next page instead of restarting it for each observer. */
function useCompleteCatalog(query: CatalogQuery, enabled: boolean) {
    const { fetchNextPage } = query;

    const next = React.useCallback(() => fetchNextPage({ cancelRefetch: false }), [fetchNextPage]);

    useAutoLoadPages({ ...query, fetchNextPage: next }, { enabled });
}

/** Group is part of the identity: e.g. `other` is both a kind and a topic. */
function groupedNewsNames(rows: ReadonlyArray<V2NewsKindCatalogEntry>): NewsCatalogLabels {
    const names = new Map(rows.map(row => [`${row.group}:${row.value}`, row.name] as const));

    const label = (group: V2NewsKindCatalogEntry["group"], value: string) => names.get(`${group}:${value}`) || value;

    return {
        developmentTopicLabel: value => label("development_topic", value),
        kindLabel: value => label("kind", value),
        topicLabel: value => label("topic", value),
    };
}

/** Same unfiltered, hour-cached catalog query as the catalog tab and alert pickers; follows every cursor page. */
export function useNewsCatalogLabels(enabled = true): NewsCatalogLabels {
    const query = useNewsKindCatalogInfinite({ enabled });

    useCompleteCatalog(query, enabled);

    return React.useMemo(() => groupedNewsNames(query.error ? [] : query.data?.pages.flatMap(page => page.data) ?? []), [query.data, query.error]);
}

function useCodeNames(pages: ReadonlyArray<{ data: ReadonlyArray<{ code: string; name: string }> }> | undefined) {
    return React.useMemo(() => {
        const names = new Map(pages?.flatMap(page => page.data.map(row => [row.code, row.name] as const)) ?? []);

        return (code: string): string => names.get(code) || code;
    }, [pages]);
}

export function useDividendTypeNames(enabled = true) {
    const query = useDividendTypeCatalogInfinite({ enabled });

    useCompleteCatalog(query, enabled);

    return useCodeNames(query.error ? undefined : query.data?.pages);
}

export function useHaltReasonNames(enabled = true) {
    const query = useHaltReasonCatalogInfinite({ enabled });

    useCompleteCatalog(query, enabled);

    return useCodeNames(query.error ? undefined : query.data?.pages);
}
