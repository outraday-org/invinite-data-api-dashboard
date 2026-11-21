import type * as React from "react";

import { DebouncedInput } from "@/components/navigation/debounced-input";
import { DayRange } from "@/components/ui/day-range";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * The filings page header: form picker (`meta.form_facet`), 8-K items (comma list, sent as `items`), the filed-day range
 * (`filed_at.gte` / `.lte`), the facet's count + newest filing date, and the page's own actions (Live, Search).
 */
export function FilingsHeader({
    actions,
    availableFormTypes,
    facetLine,
    formTypeFilter,
    from,
    items,
    loadingFormTypes,
    onFormTypeChange,
    onItemsChange,
    onRangeChange,
    sortDirection,
    to,
}: {
    actions?: React.ReactNode;
    availableFormTypes: Array<string>;
    /** "31 10-K filings, newest filed 2026-11-03" (`facetSummary`); null = unknown. */
    facetLine?: null | string;
    formTypeFilter: null | string;
    from?: string;
    items?: string;
    loadingFormTypes: boolean;
    onFormTypeChange: (val: null | string) => void;
    onItemsChange?: (items: string) => void;
    onRangeChange?: (patch: { from?: string; to?: string }) => void;
    sortDirection: "asc" | "desc";
    to?: string;
}) {
    return (
        <PageHeader
            actions={(
                <>
                    <Select
                        disabled={loadingFormTypes || availableFormTypes.length === 0}
                        onValueChange={val => onFormTypeChange(val === "all" ? null : val)}
                        value={formTypeFilter ?? "all"}
                    >
                        <SelectTrigger aria-label="Form type" className="w-[180px]">
                            {!formTypeFilter || formTypeFilter === "all" ? "All form types" : <SelectValue />}
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All form types</SelectItem>
                            {availableFormTypes.map(type => (
                                <SelectItem key={type} value={type}>
                                    {type}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {onItemsChange && (
                        <DebouncedInput
                            aria-label="8-K items"
                            className="w-[170px]"
                            onCommit={onItemsChange}
                            placeholder="8-K items, e.g. 2.02"
                            value={items ?? ""}
                        />
                    )}
                    {onRangeChange && (
                        <DayRange from={from} labels={{ from: "Filed from", to: "Filed to" }} onChange={onRangeChange} to={to} />
                    )}
                    {actions}
                </>
            )}
            description={[`SEC filings by form type, ${sortDirection === "desc" ? "newest first" : "oldest first"}.`, facetLine].filter(Boolean).join(" · ")}
            title="Filings"
        />
    );
}
