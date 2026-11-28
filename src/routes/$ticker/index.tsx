import { createFileRoute } from "@tanstack/react-router";

import type { V2Instrument } from "@/lib/api/types";

import { AlertEntryPoints, ENTRY_TYPES } from "@/components/alerts/create-alert-button";
import { PageHeader } from "@/components/ui/page-header";
import { useInstrument } from "@/lib/api/queries";
import { isFundType } from "@/lib/instruments";
import { tickerHead } from "@/lib/layout";

import { DelistedNotice } from "./-components/delisted-notice";
import { CompanyOverview } from "./-overview/company-overview";
import { FundOverview, InstrumentOverview } from "./-overview/fund-overview";
import { OverviewSkeleton } from "./-overview/overview-parts";

export const Route = createFileRoute("/$ticker/")({
    component: TickerOverview,
    head: ({ params }) => tickerHead(params.ticker, "Overview"),
});

/** A stock's header has none: the company's own description follows it ("description first: it says what this is"). */
const OVERVIEW_DESCRIPTIONS = {
    etn: "The listing of this exchange-traded note.",
    fund: "The fund's profile, share classes and composition.",
    stock: undefined,
} as const;

function overviewKind(type: V2Instrument["type"]): keyof typeof OVERVIEW_DESCRIPTIONS {
    if (type === "stock") return "stock";

    return isFundType(type) ? "fund" : "etn";
}

/**
 * The overview of one instrument (Data API 7.0): a stock's company profile (`/v1/companies/{company}`), a fund's profile
 * (`/v1/funds/{fund}`) or, for an ETN, the instrument itself — all from sections and stat grids (ui-redesign task 8,
 * views in `-overview/`). The layout already read the instrument (same query).
 */
function TickerOverview() {
    const { ticker } = Route.useParams();

    const { data: instrument, isLoading } = useInstrument(ticker);

    if (isLoading) return <OverviewSkeleton />;

    // The layout renders the unknown / failed instrument states.
    if (!instrument) return null;

    // Delisted overviews show the instrument record and history notice. Stocks have no company profile;
    // verified fund profiles remain available from the API, while this overview keeps the same listing presentation.
    const overview = !instrument.is_active
        ? (
                <>
                    <DelistedNotice instrument={instrument} onOverview />
                    <InstrumentOverview instrument={instrument} />
                </>
            )
        : instrument.type === "stock"
            ? <CompanyOverview datasets={instrument.datasets} ticker={ticker} />
            : isFundType(instrument.type) ? <FundOverview instrument={instrument} ticker={ticker} /> : <InstrumentOverview instrument={instrument} />;

    return (
        <div className="flex flex-col gap-6">
            {/* "Create alert" (price types; a stock's metrics too) and the ticker's alerts link (alerts task 4). */}
            <PageHeader actions={<AlertEntryPoints symbol={ticker} types={ENTRY_TYPES.overview} />} description={instrument.is_active ? OVERVIEW_DESCRIPTIONS[overviewKind(instrument.type)] : "The listing of this delisted symbol."} title="Overview" />
            {overview}
        </div>
    );
}
