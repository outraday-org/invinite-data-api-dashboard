import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import { EtfCompositionList, EtfWeightsBlock } from "@/components/sec/etf-views";
import { useV2EtfHoldingsInfinite, useV2EtfWeightsInfinite } from "@/lib/api/queries";
import { etfPickerDays } from "@/lib/sec/etf";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

export const Route = createFileRoute("/$ticker/etf-holdings/")({
    component: EtfHoldingsPage,
});

/** Positions per page (the API allows up to 1 000; the top of the fund first). */
const POSITIONS_PAGE = 50;

/** The picker's "server default" entry: no `as_of` sent (the freshest composition). */
const FRESHEST = "freshest";

/**
 * An ETF's composition (Data API release 5.10): the freshest holdings — the issuer's daily / monthly file, else the
 * fund's latest N-PORT report — labelled with source and as-of date, a picker over the stored days
 * (`meta.composition.stored_dates`), and the sector / country / asset-class weights of the same composition. Any other
 * ticker answers 404 `not_covered` (shown as a notice).
 */
function EtfHoldingsPage() {
    const { ticker } = Route.useParams();

    const [day, setDay] = React.useState<string>(FRESHEST);

    const asOf = day === FRESHEST ? undefined : day;

    const holdings = useV2EtfHoldingsInfinite({ asOf, etf: ticker, limit: POSITIONS_PAGE });

    const weights = useV2EtfWeightsInfinite({ asOf, etf: ticker, limit: 200 });

    const stored = holdings.data?.pages.at(0)?.meta.composition?.stored_dates;

    const options = React.useMemo(() => [{ label: "Freshest", value: FRESHEST }, ...etfPickerDays(stored)], [stored]);

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-col gap-1">
                    <div>ETF Holdings</div>
                    <div className="text-muted-foreground text-sm">
                        What this ETF holds, from the issuer&apos;s own holdings file (daily or monthly) or else the fund&apos;s
                        latest N-PORT filing, always with its as-of date; weights by sector, country and asset class.
                    </div>
                </div>
                <FilterSelect className="w-[260px]" onValueChange={setDay} options={options} value={day} />
            </div>

            <EtfWeightsBlock
                state={{
                    error: weights.error,
                    hasNextPage: weights.hasNextPage,
                    isFetchingNextPage: weights.isFetchingNextPage,
                    isLoading: weights.isLoading,
                    onLoadMore: () => weights.fetchNextPage(),
                    pages: weights.data?.pages ?? [],
                }}
            />

            <div className="grow relative">
                <EtfCompositionList
                    state={{
                        error: holdings.error,
                        hasNextPage: holdings.hasNextPage,
                        isFetchingNextPage: holdings.isFetchingNextPage,
                        isLoading: holdings.isLoading,
                        onLoadMore: () => holdings.fetchNextPage(),
                        pages: holdings.data?.pages ?? [],
                    }}
                />
            </div>
        </div>
    );
}
