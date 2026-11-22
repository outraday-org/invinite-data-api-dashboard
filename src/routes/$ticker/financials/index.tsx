import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { FinancialView } from "@/components/financials-pages/views";

import { financialsSearchSchema } from "@/components/financials-pages/financials-search";
import { financialViewsFor } from "@/components/financials-pages/views";
import { ChartParamContext } from "@/components/metric-chart/use-chart-selection";
import { TabStrip } from "@/components/navigation/tab-strip";
import { useInstrument } from "@/lib/api/queries";
import { tickerHead } from "@/lib/layout";
import { IN_PLACE } from "@/lib/url-state";

/**
 * The one Financials page of an instrument: `?view=standardized|as-reported|ratios|growth|cagr|segments` (default
 * standardized) as in-page tabs; a tab whose dataset the instrument's `datasets` lack is hidden. The former six routes
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

    return (
        <div className="flex flex-col gap-4">
            <TabStrip
                aria-label="Financials view"
                onSelect={(value: FinancialView) => void navigate({ ...IN_PLACE, search: { view: value === "standardized" ? undefined : value } })}
                options={views.map(entry => ({ label: entry.label, value: entry.value }))}
                value={active.value}
            />
            <ChartParamContext value={chartParam}>
                <active.Body key={active.value} ticker={ticker} />
            </ChartParamContext>
        </div>
    );
}
