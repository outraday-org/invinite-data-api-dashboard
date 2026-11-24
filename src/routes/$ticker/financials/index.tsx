import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import { financialsSearchSchema, tabSearch } from "@/components/financials-pages/financials-search";
import { financialViewsFor } from "@/components/financials-pages/views";
import { ChartParamContext } from "@/components/metric-chart/use-chart-selection";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInstrument } from "@/lib/api/queries";
import { tickerHead, WRAPPING_TABS_LIST_CLASS } from "@/lib/layout";
import { IN_PLACE } from "@/lib/url-state";

/**
 * The one Financials page of an instrument: `?view=standardized|as-reported|ratios|growth|cagr|segments` (default
 * standardized) as line tabs under the page header "Financials" (each tab body renders the header, the tab row it is
 * handed, its two toolbar rows and its table — ui-redesign task 9); a tab whose dataset the instrument's `datasets` lack
 * is hidden. The former six routes
 * (`/$ticker/financials-standardized` …, `/$ticker/segmented-financials`) redirect here with their query kept.
 */
export const Route = createFileRoute("/$ticker/financials/")({
    component: FinancialsPage,
    head: ({ params }) => tickerHead(params.ticker, "Financials"),
    validateSearch: financialsSearchSchema,
});

function FinancialsPage() {
    const { ticker } = Route.useParams();

    const { chart, view } = Route.useSearch();

    const navigate = Route.useNavigate();

    // The layout mounts this page only once the instrument is known (same query, no extra request).
    const { data: instrument } = useInstrument(ticker);

    const views = financialViewsFor(instrument?.datasets ?? null);

    const active = views.find(entry => entry.value === view) ?? views.at(0);

    // `?chart=` opens the charted row of the tab's table (a deep link; closing it clears the param).
    const chartParam = React.useMemo(() => ({
        chart: chart ?? null,
        setChart: (key: null | string) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, chart: key ?? undefined }) }),
    }), [chart, navigate]);

    if (!active) return null;

    // A tab's value is one of the shown views (never cast: an unknown value changes nothing).
    const selectView = (value: unknown) => {
        const next = views.find(entry => entry.value === value);

        if (next) void navigate({ ...IN_PLACE, search: prev => tabSearch(prev, next.value) });
    };

    const tabs = (
        // Wraps at phone width: the page never scrolls sideways.
        <TabsList aria-label="Financials view" className={WRAPPING_TABS_LIST_CLASS} variant="line">
            {views.map(entry => <TabsTrigger key={entry.value} value={entry.value}>{entry.label}</TabsTrigger>)}
        </TabsList>
    );

    return (
        <Tabs onValueChange={selectView} value={active.value}>
            <ChartParamContext value={chartParam}>
                <active.Body key={active.value} tabs={tabs} ticker={ticker} />
            </ChartParamContext>
        </Tabs>
    );
}
