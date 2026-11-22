import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";

import { HolderChangesList } from "@/components/sec/holder-views";
import { ChangeTypeChips } from "@/components/sec/ownership-views";
import {
    SecFilerHeader,
    SecFilingsView,
    SecFundView,
    SecLifecycleView,
    SecPortfolioView,
    SecPrivateOfferingsView,
} from "@/components/sec/sec-filer-views";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { Button } from "@/components/ui/button";
import { NotFound } from "@/components/ui/not-found";
import { isNotFound } from "@/lib/api/errors";
import { listState } from "@/lib/api/list-state";
import { useFilerHoldingChangesInfinite, useFilerHoldingsInfinite, useV2Filer, useV2FilingsInfinite, useV2OfferingsInfinite } from "@/lib/api/queries";
import { V2_FILER_EXPANDS } from "@/lib/api/v2";
import { formatDay } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { FILER_ANCHORS, FILER_FILINGS_PAGE, isManagerFiler } from "@/lib/navigation";
import { recentFiler, useRecordRecent } from "@/lib/recents";
import { changeTypesParam, INSTRUMENT_OPTIONS, parseChangeTypes } from "@/lib/sec/ownership";
import { latest13fPeriodEnd, QUARTER_PICKER_COUNT, quarterPickerOptions } from "@/lib/sec/source";
import { IN_PLACE, optionalAccession, optionalDay, optionalEnum, optionalFlag, optionalText } from "@/lib/url-state";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

/**
 * `?form=` (the filings' form filter), `?period=<quarter end>` (the 13F portfolio, asked once set), `?instruments=all`
 * (the portfolio incl. options and principal amounts), `?changes=true` (the position changes, asked once set) with
 * `?ctypes=new,added`, `?docs=<accession>`.
 */
const filerSearchSchema = z.object({
    changes: optionalFlag(),
    ctypes: optionalText(60),
    docs: optionalAccession(),
    form: optionalText(20),
    instruments: optionalEnum(["all"]),
    period: optionalDay(),
});

/**
 * One SEC filer by CIK — outside `$ticker` on purpose: a pre-IPO issuer, a SPAC or a 13F manager without an exchange
 * listing has no ticker, and none is invented (no asset row, no fake `$ticker`). Reached from the search, `/institutions`,
 * the holders / holdings / portfolio cells and the company overview's CIK; the sidebar's context lists its blocks
 * (`FILER_ANCHORS`). Identity + lifecycle = one `GET /v1/filers/{cik}` with every
 * expansion (`fund` = a fund registrant's series, its own block when the filer has any; `private_offerings` = the
 * summary of its Form D private offerings, whose rows then come from `GET /v1/offerings?company=<cik>`); the filings = `GET /v1/filings?symbol=<cik>` (a CIK with a listed stock or a fund that is its own registrant; an unlisted filer answers 404, as 6.x's `company=<cik>`); a 13F manager's portfolio = `GET /v1/filers/{cik}/holdings`
 * for one quarter, asked on a click.
 */
export const Route = createFileRoute("/sec/$cik")({
    component: SecFilerPage,
    head: ({ params }) => titleHead(`SEC filer ${params.cik}`),
    validateSearch: filerSearchSchema,
});

const PORTFOLIO_PAGE = 25;

const OFFERINGS_PAGE = 25;

const CHANGES_PAGE = 50;

function SecFilerPage() {
    const { cik: rawCik } = Route.useParams();

    const cik = /^\d{1,10}$/.test(rawCik) ? String(Number(rawCik)) : "";

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: z.infer<typeof filerSearchSchema>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const form = search.form ?? null;

    const target: null | SecPanelTarget = search.docs ? { accession: search.docs, kind: "filing", title: `CIK ${cik} · ${search.docs}` } : null;

    // The 13F portfolio costs a request: asked on a click, for the newest quarter whose reports are due.
    const period = search.period ?? null;

    // The newest quarter whose 13F reports are due, taken once per mount (the picker's first entry).
    const [latestQuarter] = React.useState(() => latest13fPeriodEnd(new Date()));

    const filer = useV2Filer(cik, V2_FILER_EXPANDS);

    const filings = useV2FilingsInfinite({ form: form ? [form] : undefined, limit: FILER_FILINGS_PAGE, symbol: cik });

    // Idle (no CIK) until a quarter is picked.
    const portfolio = useFilerHoldingsInfinite({ cik: period ? cik : "", instruments: search.instruments, limit: PORTFOLIO_PAGE, periodEnd: period ?? undefined });

    const changeTypes = parseChangeTypes(search.ctypes) ?? [];

    // The position changes cost a request: asked on a click, for the portfolio's quarter (else the newest due one).
    const changes = useFilerHoldingChangesInfinite({
        cik: search.changes ? cik : "",
        limit: CHANGES_PAGE,
        periodEnd: period ?? undefined,
        type: changeTypes.length > 0 ? changeTypes : undefined,
    });

    const privateOfferings = filer.data?.private_offerings ?? null;

    // The offerings list costs a request: only for a filer whose summary names at least one offering.
    const offerings = useV2OfferingsInfinite({
        company: cik,
        enabled: cik.length > 0 && (privateOfferings?.count ?? 0) > 0,
        limit: OFFERINGS_PAGE,
    });

    useRecordRecent(filer.data ? recentFiler(filer.data) : null);

    if (!cik) return <NotFound />;

    const facet = filings.data?.pages[0]?.meta.form_facet ?? [];

    const isManager = isManagerFiler(filer.data, facet.map(entry => entry.form));

    // A CIK the registry does not know (404 not_covered) is that one notice, not repeated by the lifecycle and filings
    // blocks (UI walk F089).
    if (isNotFound(filer.error)) {
        return (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-8">
                <SecFilerHeader cik={cik} data={null} error={filer.error} isLoading={false} />
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-8">
            <section className="flex scroll-mt-20 flex-col gap-4" id={FILER_ANCHORS.profile}>
                <SecFilerHeader cik={cik} data={filer.data} error={filer.error} isLoading={filer.isLoading} />
                <h3 className="text-sm font-semibold">Lifecycle</h3>
                <SecLifecycleView data={filer.data} error={filer.error} isLoading={filer.isLoading} />
            </section>

            {filer.data?.fund && (
                <section className="flex scroll-mt-20 flex-col gap-2" id={FILER_ANCHORS.fund}>
                    <h3 className="text-sm font-semibold">Fund series</h3>
                    <SecFundView data={filer.data} />
                </section>
            )}

            {privateOfferings && (
                <section className="flex scroll-mt-20 flex-col gap-2" id={FILER_ANCHORS.offerings}>
                    <h3 className="text-sm font-semibold">Private offerings (Form D)</h3>
                    <SecPrivateOfferingsView
                        error={offerings.error}
                        exportScope={`cik-${cik}`}
                        hasNextPage={Boolean(offerings.hasNextPage)}
                        isFetchingNextPage={offerings.isFetchingNextPage}
                        isLoading={offerings.isLoading}
                        onMore={() => void offerings.fetchNextPage()}
                        pages={offerings.data?.pages ?? []}
                        summary={privateOfferings}
                    />
                </section>
            )}

            {isManager && (
                <section className="flex scroll-mt-20 flex-col gap-2" id={FILER_ANCHORS.portfolio}>
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">13F portfolio</h3>
                        {!period && (
                            <Button onClick={() => onChange({ period: latestQuarter })} size="xs" type="button" variant="outline">
                                Load the latest quarter
                            </Button>
                        )}
                        {period && (
                            <FilterSelect
                                aria-label="13F quarter"
                                className="w-[210px]"
                                onValueChange={value => onChange({ period: value })}
                                options={quarterPickerOptions(latestQuarter, QUARTER_PICKER_COUNT, period)}
                                value={period}
                            />
                        )}
                        <FilterSelect
                            aria-label="13F instruments"
                            className="w-[210px]"
                            onValueChange={value => onChange({ instruments: value === "all" ? "all" : undefined })}
                            options={INSTRUMENT_OPTIONS}
                            value={search.instruments ?? "shares"}
                        />
                    </div>
                    {period && (
                        <SecPortfolioView
                            error={portfolio.error}
                            exportScope={`cik-${cik}`}
                            hasNextPage={Boolean(portfolio.hasNextPage)}
                            isFetchingNextPage={portfolio.isFetchingNextPage}
                            isLoading={portfolio.isLoading}
                            onMore={() => void portfolio.fetchNextPage()}
                            pages={portfolio.data?.pages ?? []}
                        />
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">Position changes</h3>
                        {search.changes
                            ? <span className="text-muted-foreground text-xs">{period ? `Quarter ending ${formatDay(period)} vs the one before` : "The latest due quarter vs the one before"}</span>
                            : (
                                    <Button onClick={() => onChange({ changes: true })} size="xs" type="button" variant="outline">
                                        Load the changes
                                    </Button>
                                )}
                    </div>
                    {search.changes && (
                        <div className="flex flex-col gap-2" data-testid="position-changes">
                            <ChangeTypeChips onChange={types => onChange({ ctypes: changeTypesParam(types) })} value={changeTypes} />
                            <HolderChangesList
                                exportScope={`cik-${cik}`}
                                state={listState(changes)}
                                subject="security"
                            />
                        </div>
                    )}
                </section>
            )}

            <section className="flex scroll-mt-20 flex-col gap-2" id={FILER_ANCHORS.filings}>
                <h3 className="text-sm font-semibold">Filings</h3>
                <SecFilingsView
                    error={filings.error}
                    form={form}
                    hasNextPage={Boolean(filings.hasNextPage)}
                    isFetchingNextPage={filings.isFetchingNextPage}
                    isLoading={filings.isLoading}
                    onFormChange={value => onChange({ form: value ?? undefined })}
                    onMore={() => void filings.fetchNextPage()}
                    onOpen={next => onChange({ docs: next.kind === "filing" ? next.accession : undefined })}
                    pages={filings.data?.pages ?? []}
                />
            </section>

            <SecSourceDialog onClose={() => onChange({ docs: undefined })} target={target} />
        </div>
    );
}
