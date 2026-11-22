import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { V2HolderSource } from "@/lib/api/types";

import { DebouncedInput } from "@/components/navigation/debounced-input";
import { HolderChangesList, HoldersList, HoldersOverview } from "@/components/sec/holder-views";
import { ChangeTypeChips } from "@/components/sec/ownership-views";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listState } from "@/lib/api/list-state";
import { useHolderChangesInfinite, useHoldersInfinite } from "@/lib/api/queries";
import { formatDay } from "@/lib/format";
import { tickerHead, WRAPPING_TABS_LIST_CLASS } from "@/lib/layout";
import { HOLDER_SOURCE_LABELS } from "@/lib/sec/fund";
import { changeTypesParam, INSTRUMENT_OPTIONS, parseChangeTypes, parseCikList } from "@/lib/sec/ownership";
import { latest13fPeriodEnd, QUARTER_PICKER_COUNT, quarterPickerOptions, recentQuarterEnds } from "@/lib/sec/source";
import { IN_PLACE, optionalDay, optionalEnum, optionalText } from "@/lib/url-state";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

const TABS = ["overview", "13f", "nport", "issuer_file", "changes"] as const;

/**
 * `?tab=` (default overview), `?period=<quarter end>` (default: the latest due quarter, nothing sent), `?instruments=all`
 * (13F incl. options and principal amounts; default common shares), and the changes tab's `?types=new,added`,
 * `?filer=<CIK list>`, `?prior=<quarter end>`.
 */
const holdersSearchSchema = z.object({
    filer: optionalText(600),
    instruments: optionalEnum(["all"]),
    period: optionalDay(),
    prior: optionalDay(),
    tab: optionalEnum(TABS),
    types: optionalText(60),
});

type HoldersSearch = z.infer<typeof holdersSearchSchema>;

export const Route = createFileRoute("/$ticker/holders/")({
    component: HoldersPage,
    head: ({ params }) => tickerHead(params.ticker, "Holders"),
    validateSearch: holdersSearchSchema,
});

/** Holder rows per page (the API allows up to 1 000). */
const HOLDERS_PAGE = 100;

/** Quarter ends the period picker offers (newest due quarter first). */
const PICKER_QUARTERS = QUARTER_PICKER_COUNT;

/** The picker's "server default" entry: no `period_end` sent (13F: the newest quarter whose deadline passed; N-PORT: today). */
const LATEST = "latest";

type Tab = (typeof TABS)[number];

const SOURCES: ReadonlyArray<V2HolderSource> = ["13f", "nport", "issuer_file"];

/** The default prior quarter: the API's previous quarter (nothing sent). */
const PREVIOUS = "previous";

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

    const onChange = (patch: Partial<HoldersSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const setTab = (value: Tab) => onChange({ tab: value === "overview" ? undefined : value });

    // The picker's quarters, from the newest one whose 13F reports are due (taken once per mount).
    const [quarters] = React.useState(() => recentQuarterEnds(latest13fPeriodEnd(new Date()), PICKER_QUARTERS));

    const periodEnd = search.period;

    const period = periodEnd ?? LATEST;

    const setPeriod = (value: string) => onChange({ period: value === LATEST ? undefined : value });

    // `instruments` is a 13F filter: sent with the overview and the 13F list only.
    const instruments = search.instruments;

    const instrumentsApply = tab === "overview" || tab === "13f";

    const changeTypes = parseChangeTypes(search.types) ?? [];

    const filers = parseCikList(search.filer);

    // The prior quarter is one of the quarters before the picked (or latest due) one.
    const priorOptions = React.useMemo(() => {
        const current = periodEnd ?? quarters[0];

        const before = recentQuarterEnds(current, PICKER_QUARTERS + 1).slice(1);

        return [
            { label: "The previous quarter", value: PREVIOUS },
            ...[...before, ...(search.prior && !before.includes(search.prior) ? [search.prior] : [])]
                .map(quarter => ({ label: `Compared with ${formatDay(quarter)}`, value: quarter })),
        ];
    }, [periodEnd, quarters, search.prior]);

    // A linked quarter older than the picker's is offered too (the URL is the state; as on `/sec/$cik`).
    const periodOptions = React.useMemo(
        () => [{ label: "Latest due quarter", value: LATEST }, ...quarterPickerOptions(quarters[0], PICKER_QUARTERS, periodEnd ?? null)],
        [periodEnd, quarters],
    );

    const overview = useHoldersInfinite({ instruments, limit: 25, periodEnd, symbol: tab === "overview" ? ticker : "" });

    const thirteenF = useHoldersInfinite({ instruments, limit: HOLDERS_PAGE, periodEnd, source: "13f", symbol: tab === "13f" ? ticker : "" });

    const nport = useHoldersInfinite({ limit: HOLDERS_PAGE, periodEnd, source: "nport", symbol: tab === "nport" ? ticker : "" });

    // Issuer files are read as of their newest file: the quarter picker does not apply.
    const issuerFile = useHoldersInfinite({ limit: HOLDERS_PAGE, source: "issuer_file", symbol: tab === "issuer_file" ? ticker : "" });

    const changes = useHolderChangesInfinite({
        filer: filers,
        limit: HOLDERS_PAGE,
        periodEnd,
        priorPeriodEnd: search.prior,
        symbol: tab === "changes" ? ticker : "",
        type: changeTypes.length > 0 ? changeTypes : undefined,
    });

    const bySource = { "13f": thirteenF, "issuer_file": issuerFile, "nport": nport };

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                actions={(
                    <>
                        {/* Issuer files are read as of their newest file: the quarter does not apply on that tab ([FU2870]). */}
                        <FilterSelect
                            aria-label="Quarter"
                            className="w-[220px]"
                            disabled={tab === "issuer_file"}
                            onValueChange={setPeriod}
                            options={periodOptions}
                            title={tab === "issuer_file" ? "Issuer files are read as of their newest file" : undefined}
                            value={period}
                        />
                        <FilterSelect
                            aria-label="13F instruments"
                            className="w-[210px]"
                            disabled={!instrumentsApply}
                            onValueChange={value => onChange({ instruments: value === "all" ? "all" : undefined })}
                            options={INSTRUMENT_OPTIONS}
                            title={instrumentsApply ? "13F positions counted" : "Applies to the overview and the 13F list"}
                            value={instruments ?? "shares"}
                        />
                    </>
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
                {/* Wraps at phone width: the page never scrolls sideways. */}
                <TabsList className={WRAPPING_TABS_LIST_CLASS} variant="line">
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

                <TabsContent className="relative mt-2 flex flex-col gap-3" value="changes">
                    <div className="flex flex-wrap items-center gap-2" data-testid="changes-filters">
                        <ChangeTypeChips onChange={types => onChange({ types: changeTypesParam(types) })} value={changeTypes} />
                        <FilterSelect
                            aria-label="Prior quarter"
                            className="w-[220px]"
                            onValueChange={value => onChange({ prior: value === PREVIOUS ? undefined : value })}
                            options={priorOptions}
                            value={search.prior ?? PREVIOUS}
                        />
                        <DebouncedInput
                            aria-label="Manager CIKs"
                            className="w-[220px]"
                            onCommit={value => onChange({ filer: value.trim() || undefined })}
                            placeholder="Manager CIKs (comma list)"
                            value={search.filer ?? ""}
                        />
                        {search.filer && !filers && <span className="text-muted-foreground text-xs">No CIK in this list: every manager is shown</span>}
                    </div>
                    <HolderChangesList exportScope={ticker} state={listState(changes)} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
