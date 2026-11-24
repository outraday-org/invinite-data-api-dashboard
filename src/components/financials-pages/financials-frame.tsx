import * as React from "react";

import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";

import type { FinancialsSearch } from "./financials-search";

/** The children of a fragment as separate items (a `FilterBar` counts its fields to decide whether it collapses). */
function flatten(node: React.ReactNode): Array<React.ReactNode> {
    return React.Children.toArray(node).flatMap(child => (
        React.isValidElement<{ children?: React.ReactNode }>(child) && child.type === React.Fragment ? flatten(child.props.children) : [child]
    ));
}

/** The props of every Financials tab body: the route's tab row (rendered under the page header) and the instrument. */
export type FinancialsTabProps = { tabs: React.ReactNode; ticker: string };

/** The "when" filters of the statement tabs: the fiscal-year window (one filter), as of, from filing. */
export const STATEMENT_FILTERS: ReadonlyArray<ReadonlyArray<keyof FinancialsSearch>> = [["fyFrom", "fyTo"], ["asOf"], ["filing"]];

/** The fiscal-year window, the one "when" filter of the metrics tabs. */
export const FISCAL_YEAR_FILTER: ReadonlyArray<keyof FinancialsSearch> = ["fyFrom", "fyTo"];

/** How many of the given URL filters are set (a "from – to" pair counts once): the `FilterBar`'s "Filters · n". */
export function financialsFilterCount(search: FinancialsSearch, groups: ReadonlyArray<ReadonlyArray<keyof FinancialsSearch>>) {
    return groups.filter(keys => keys.some(key => search[key] !== undefined)).length;
}

/**
 * The frame of every Financials tab (ui-redesign task 9): the page header "Financials" (the description is the shown
 * view's), the tab row, then the two toolbar rows — row 1 = "what" (statement, layout, period, a tab's metric
 * family: segmented controls and selects that never split inside a group; below 640 px the row scrolls sideways in
 * itself and stays visible), row 2 = "when" and the narrowing filters in a labelled `FilterBar` (fiscal years, as of,
 * from filing, …; "Filters · n" below 640 px, "Reset filters" while one is set) — then the tab's content.
 */
export function FinancialsFrame({
    activeCount,
    children,
    description,
    filters,
    onReset,
    tabs,
    what,
}: {
    activeCount: number;
    children: React.ReactNode;
    description: React.ReactNode;
    filters: React.ReactNode;
    onReset: () => void;
    tabs: React.ReactNode;
    what: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4">
            <PageHeader description={description} title="Financials" />
            {tabs}
            <div className="flex flex-col gap-3">
                <div
                    aria-label="What to show"
                    className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0"
                    data-slot="financials-what"
                    role="group"
                >
                    {what}
                </div>
                <FilterBar activeCount={activeCount} onReset={onReset}>
                    {flatten(filters)}
                </FilterBar>
            </div>
            {children}
        </div>
    );
}
