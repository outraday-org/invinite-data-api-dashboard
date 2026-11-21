import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { V2HolderSource } from "@/lib/api/types";

import { HolderChangesList, HoldersList, HoldersOverview } from "@/components/sec/holder-views";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHolderChangesInfinite, useHoldersInfinite } from "@/lib/api/queries";
import { formatDay } from "@/lib/format";
import { tickerHead } from "@/lib/layout";
import { HOLDER_SOURCE_LABELS } from "@/lib/sec/fund";
import { latest13fPeriodEnd, recentQuarterEnds } from "@/lib/sec/source";
import { IN_PLACE, optionalDay, optionalEnum } from "@/lib/url-state";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

const TABS = ["overview", "13f", "nport", "issuer_file", "changes"] as const;

/** `?tab=` (default overview) and `?period=<quarter end>` (default: the latest due quarter, nothing sent). */
const holdersSearchSchema = z.object({ period: optionalDay(), tab: optionalEnum(TABS) });

export const Route = createFileRoute("/$ticker/holders/")({
    component: HoldersPage,
    head: ({ params }) => tickerHead(params.ticker, "Holders"),
    validateSearch: holdersSearchSchema,
});

/** Holder rows per page (the API allows up to 1 000). */
const HOLDERS_PAGE = 100;

/** Quarter ends the period picker offers (newest due quarter first). */
const PICKER_QUARTERS = 8;

/** The picker's "server default" entry: no `period_end` sent (13F: the newest quarter whose deadline passed; N-PORT: today). */
const LATEST = "latest";

type Tab = (typeof TABS)[number];

const SOURCES: ReadonlyArray<V2HolderSource> = ["13f", "nport", "issuer_file"];

/** A list view's state from an infinite query (the pages so far, "Load more"). */
function listState<TPage>(query: {
    data: null | { pages: Array<TPage> };
    error: unknown;
    fetchNextPage: () => unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
}) {
    return {
        error: query.error,
        hasNextPage: query.hasNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
        isLoading: query.isLoading,
        onLoadMore: () => void query.fetchNextPage(),
        pages: query.data?.pages ?? [],
    };
}

/**
 * Who holds this stock or fund (Data API 7.0, `/v1/holders?symbol=`, owner decision 12): an overview of the three
 * sources (13F managers, N-PORT funds, ETF issuer files — each with its own as-of, never merged), each source's full
 * list, and the 13F position changes. A source's list is only asked once its tab is open.
 */
function HoldersPage() {
    const { ticker } = Route.useParams();

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const tab: Tab = search.tab ?? "overview";

    const setTab = (value: Tab) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, tab: value === "overview" ? undefined : value }) });

    // The picker's quarters, from the newest one whose 13F reports are due (taken once per mount).
    const [quarters] = React.useState(() => recentQuarterEnds(latest13fPeriodEnd(new Date()), PICKER_QUARTERS));

    const periodEnd = search.period;

    const period = periodEnd ?? LATEST;

    const setPeriod = (value: string) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, period: value === LATEST ? undefined : value }) });

    // A linked quarter older than the picker's is offered too (the URL is the state).
    const periodOptions = React.useMemo(
        () => [
            { label: "Latest due quarter", value: LATEST },
            ...[...quarters, ...(periodEnd && !quarters.includes(periodEnd) ? [periodEnd] : [])]
                .map(quarter => ({ label: `Quarter ending ${formatDay(quarter)}`, value: quarter })),
        ],
        [periodEnd, quarters],
    );

    const overview = useHoldersInfinite({ limit: 25, periodEnd, symbol: tab === "overview" ? ticker : "" });

    const thirteenF = useHoldersInfinite({ limit: HOLDERS_PAGE, periodEnd, source: "13f", symbol: tab === "13f" ? ticker : "" });

    const nport = useHoldersInfinite({ limit: HOLDERS_PAGE, periodEnd, source: "nport", symbol: tab === "nport" ? ticker : "" });

    // Issuer files are read as of their newest file: the quarter picker does not apply.
    const issuerFile = useHoldersInfinite({ limit: HOLDERS_PAGE, source: "issuer_file", symbol: tab === "issuer_file" ? ticker : "" });

    const changes = useHolderChangesInfinite({ limit: HOLDERS_PAGE, periodEnd, symbol: tab === "changes" ? ticker : "" });

    const bySource = { "13f": thirteenF, "issuer_file": issuerFile, "nport": nport };

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    // Issuer files are read as of their newest file: the quarter does not apply on that tab ([FU2870]).
                    <FilterSelect
                        aria-label="Quarter"
                        className="w-[220px]"
                        disabled={tab === "issuer_file"}
                        onValueChange={setPeriod}
                        options={periodOptions}
                        title={tab === "issuer_file" ? "Issuer files are read as of their newest file" : undefined}
                        value={period}
                    />
                )}
                description={(
                    <>
                        Who holds this security, per source: managers&apos; quarterly 13F reports, funds&apos; N-PORT
                        reports and ETFs&apos; own daily holdings files. The sources overlap and have different dates, so
                        each is listed on its own.
                    </>
                )}
                title="Holders"
            />

            <Tabs onValueChange={value => setTab(value as Tab)} value={tab}>
                <TabsList variant="line">
                    <TabsTrigger className="h-[34px]" value="overview">Overview</TabsTrigger>
                    {SOURCES.map(source => (
                        <TabsTrigger className="h-[34px]" key={source} value={source}>{HOLDER_SOURCE_LABELS[source]}</TabsTrigger>
                    ))}
                    <TabsTrigger className="h-[34px]" value="changes">13F changes</TabsTrigger>
                </TabsList>

                <TabsContent className="relative mt-2" value="overview">
                    <HoldersOverview onShowAll={setTab} state={listState(overview)} />
                </TabsContent>

                {SOURCES.map(source => (
                    <TabsContent className="relative mt-2" key={source} value={source}>
                        <HoldersList exportScope={ticker} source={source} state={listState(bySource[source])} />
                    </TabsContent>
                ))}

                <TabsContent className="relative mt-2" value="changes">
                    <HolderChangesList exportScope={ticker} state={listState(changes)} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
