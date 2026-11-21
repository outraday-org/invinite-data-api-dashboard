import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { V2FundWeightDimension } from "@/lib/api/types";

import { FundCompositionList, FundWeightsBlock } from "@/components/sec/fund-views";
import { PageHeader } from "@/components/ui/page-header";
import { listState } from "@/lib/api/list-state";
import { useFundPositionsInfinite, useFundWeightsInfinite } from "@/lib/api/queries";
import { tickerHead } from "@/lib/layout";
import { FUND_DIMENSION_LABELS, fundPickerDays } from "@/lib/sec/fund";
import { IN_PLACE, optionalDay, optionalEnum } from "@/lib/url-state";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

const DIMENSIONS = ["sector", "country", "asset_class"] as const satisfies ReadonlyArray<V2FundWeightDimension>;

const ALL_DIMENSIONS = "all";

const DIMENSION_OPTIONS: Array<{ label: string; value: typeof ALL_DIMENSIONS | V2FundWeightDimension }> = [
    { label: "Every weight dimension", value: ALL_DIMENSIONS },
    ...DIMENSIONS.map(dimension => ({ label: `${FUND_DIMENSION_LABELS[dimension]} weights`, value: dimension })),
];

export const Route = createFileRoute("/$ticker/holdings/")({
    component: FundHoldingsPage,
    head: ({ params }) => tickerHead(params.ticker, "Holdings"),
    // `?day=<as of>` (default: the freshest composition, nothing sent), `?dim=` (one weight dimension; default all three).
    validateSearch: z.object({ day: optionalDay(), dim: optionalEnum(DIMENSIONS) }),
});

/** Positions per page (the API allows up to 200; the top of the fund first). */
const POSITIONS_PAGE = 50;

/** The picker's "server default" entry: no `as_of` sent (the freshest composition). */
const FRESHEST = "freshest";

/**
 * A listed fund's composition (Data API 7.0, `/v1/funds/{fund}/holdings` + `/weights`): the freshest holdings — the
 * issuer's daily / monthly file, else the fund's latest N-PORT report — labelled with source and as-of date, a picker
 * over the stored days (`meta.composition.stored_dates`), and the sector / country / asset-class weights of the same
 * composition. Shown only when the instrument's `datasets` has `fund_holdings` (the layout's gate: a stock, an ETN or an
 * exchange-traded trust such as GLD never reaches it).
 */
function FundHoldingsPage() {
    const { ticker } = Route.useParams();

    const { day: asOf, dim } = Route.useSearch();

    const navigate = Route.useNavigate();

    const day = asOf ?? FRESHEST;

    const setDay = (value: string) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, day: value === FRESHEST ? undefined : value }) });

    const holdings = useFundPositionsInfinite({ asOf, fund: ticker, limit: POSITIONS_PAGE });

    const weights = useFundWeightsInfinite({ asOf, dimension: dim, fund: ticker, limit: 200 });

    const stored = holdings.data?.pages.at(0)?.meta.composition?.stored_dates;

    // A linked day not among the stored ones (yet) is offered too.
    const options = React.useMemo(() => {
        const days = fundPickerDays(stored);

        return [{ label: "Freshest", value: FRESHEST }, ...days, ...(asOf && !days.some(entry => entry.value === asOf) ? [{ label: asOf, value: asOf }] : [])];
    }, [asOf, stored]);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    <>
                        <FilterSelect aria-label="As of" className="w-[260px]" onValueChange={setDay} options={options} value={day} />
                        <FilterSelect
                            aria-label="Weight dimension"
                            className="w-[210px]"
                            onValueChange={value => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, dim: value === ALL_DIMENSIONS ? undefined : value }) })}
                            options={DIMENSION_OPTIONS}
                            value={dim ?? ALL_DIMENSIONS}
                        />
                    </>
                )}
                description={(
                    <>
                        What this fund holds, from the issuer&apos;s own holdings file (daily or monthly) or else the fund&apos;s
                        latest N-PORT filing, always with its as-of date; weights by sector, country and asset class.
                    </>
                )}
                title="Holdings"
            />

            <FundWeightsBlock
                state={listState(weights)}
            />

            <div className="relative">
                <FundCompositionList
                    exportScope={ticker}
                    state={listState(holdings)}
                />
            </div>
        </div>
    );
}
