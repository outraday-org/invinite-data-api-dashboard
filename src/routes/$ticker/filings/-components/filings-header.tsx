import type * as React from "react";

import { DebouncedInput } from "@/components/navigation/debounced-input";
import { DayRange } from "@/components/ui/day-range";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { FilterBar, FilterBarTrailing, FilterField } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";

/**
 * The filings page header (ui-redesign task 6): the title with the page's primary `actions` (alert entry point, Live)
 * and the facet's count + newest filing date as its meta line; under it one filter bar — form picker
 * (`meta.form_facet`), 8-K items (comma list, sent as `items`), the filed-day range (`filed_at.gte` / `.lte`) — with
 * `trailing` ("Search text") at its end and "Reset filters" while `activeCount` > 0.
 */
export function FilingsHeader({
    actions,
    activeCount = 0,
    availableFormTypes,
    facetLine,
    formTypeFilter,
    from,
    items,
    loadingFormTypes,
    onFormTypeChange,
    onItemsChange,
    onRangeChange,
    onReset,
    sortDirection,
    to,
    trailing,
}: {
    actions?: React.ReactNode;
    activeCount?: number;
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
    onReset?: () => void;
    sortDirection: "asc" | "desc";
    to?: string;
    /** At the end of the filter bar (the "Search text" toggle). */
    trailing?: React.ReactNode;
}) {
    return (
        <>
            <PageHeader
                actions={actions}
                description={`SEC filings by form type, ${sortDirection === "desc" ? "newest first" : "oldest first"}.`}
                meta={facetLine || undefined}
                title="Filings"
            />
            <FilterBar activeCount={activeCount} onReset={onReset}>
                <FilterField label="Form type">
                    {id => (
                        <DropdownSelect
                            aria-label="Form type"
                            className="w-full"
                            disabled={loadingFormTypes || availableFormTypes.length === 0}
                            id={id}
                            label={!formTypeFilter || formTypeFilter === "all" ? "All form types" : formTypeFilter}
                            onValueChange={val => onFormTypeChange(val === "all" ? null : val)}
                            options={[{ label: "All form types", value: "all" }, ...availableFormTypes.map(type => ({ label: type, value: type }))]}
                            value={formTypeFilter ?? "all"}
                        />
                    )}
                </FilterField>
                {onItemsChange && (
                    <FilterField label="8-K items">
                        {id => (
                            <DebouncedInput
                                aria-label="8-K items"
                                className="w-full"
                                id={id}
                                onCommit={onItemsChange}
                                placeholder="e.g. 2.02, 9.01"
                                value={items ?? ""}
                            />
                        )}
                    </FilterField>
                )}
                {onRangeChange && (
                    <FilterField label="Filed" span={2}>
                        <DayRange from={from} labels={{ from: "Filed from", to: "Filed to" }} onChange={onRangeChange} to={to} />
                    </FilterField>
                )}
                {trailing && <FilterBarTrailing>{trailing}</FilterBarTrailing>}
            </FilterBar>
        </>
    );
}
