import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import type { FinancialView } from "@/components/financials-pages/views";

import { FINANCIAL_VIEW_VALUES, financialViewsFor } from "@/components/financials-pages/views";
import { TabStrip } from "@/components/navigation/tab-strip";
import { useInstrument } from "@/lib/api/queries";
import { tickerHead } from "@/lib/layout";

const financialsSearchSchema = z.object({ view: z.enum(FINANCIAL_VIEW_VALUES).optional().catch(undefined) });

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

    const { view } = Route.useSearch();

    const navigate = Route.useNavigate();

    // The layout mounts this page only once the instrument is known (same query, no extra request).
    const { data: instrument } = useInstrument(ticker);

    const views = financialViewsFor(instrument?.datasets ?? null);

    const active = views.find(entry => entry.value === view) ?? views.at(0);

    if (!active) return null;

    return (
        <div className="flex flex-col gap-4">
            <TabStrip
                aria-label="Financials view"
                onSelect={(value: FinancialView) => void navigate({ resetScroll: false, search: { view: value === "standardized" ? undefined : value } })}
                options={views.map(entry => ({ label: entry.label, value: entry.value }))}
                value={active.value}
            />
            <active.Body key={active.value} ticker={ticker} />
        </div>
    );
}
