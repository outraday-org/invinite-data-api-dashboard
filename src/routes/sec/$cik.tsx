import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";

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
import { useFilerHoldingsInfinite, useV2Filer, useV2FilingsInfinite, useV2OfferingsInfinite } from "@/lib/api/queries";
import { V2_FILER_EXPANDS } from "@/lib/api/v2";
import { formatDay } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { FILER_ANCHORS, FILER_FILINGS_PAGE, isManagerFiler } from "@/lib/navigation";
import { latest13fPeriodEnd } from "@/lib/sec/source";

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
});

const PORTFOLIO_PAGE = 25;

const OFFERINGS_PAGE = 25;

function SecFilerPage() {
    const { cik: rawCik } = Route.useParams();

    const cik = /^\d{1,10}$/.test(rawCik) ? String(Number(rawCik)) : "";

    const [form, setForm] = React.useState<null | string>(null);

    const [target, setTarget] = React.useState<null | SecPanelTarget>(null);

    // The 13F portfolio costs a request: asked on a click, for the newest quarter whose reports are due.
    const [period, setPeriod] = React.useState<null | string>(null);

    const filer = useV2Filer(cik, V2_FILER_EXPANDS);

    const filings = useV2FilingsInfinite({ form: form ? [form] : undefined, limit: FILER_FILINGS_PAGE, symbol: cik });

    // Idle (no CIK) until a quarter is picked.
    const portfolio = useFilerHoldingsInfinite({ cik: period ? cik : "", limit: PORTFOLIO_PAGE, periodEnd: period ?? undefined });

    const privateOfferings = filer.data?.private_offerings ?? null;

    // The offerings list costs a request: only for a filer whose summary names at least one offering.
    const offerings = useV2OfferingsInfinite({
        company: cik,
        enabled: (privateOfferings?.count ?? 0) > 0,
        limit: OFFERINGS_PAGE,
    });

    if (!cik) return <NotFound />;

    const facet = filings.data?.pages[0]?.meta.form_facet ?? [];

    const isManager = isManagerFiler(filer.data?.phase, facet.map(entry => entry.form));

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
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">13F portfolio</h3>
                        {!period && (
                            <Button onClick={() => setPeriod(latest13fPeriodEnd(new Date()))} size="xs" type="button" variant="outline">
                                Load the latest quarter
                            </Button>
                        )}
                        {period && <span className="text-muted-foreground text-xs">{`Period ending ${formatDay(period)}`}</span>}
                    </div>
                    <SecPortfolioView
                        error={portfolio.error}
                        hasNextPage={Boolean(portfolio.hasNextPage)}
                        isFetchingNextPage={portfolio.isFetchingNextPage}
                        isLoading={portfolio.isLoading}
                        onMore={() => void portfolio.fetchNextPage()}
                        pages={portfolio.data?.pages ?? []}
                    />
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
                    onFormChange={setForm}
                    onMore={() => void filings.fetchNextPage()}
                    onOpen={setTarget}
                    pages={filings.data?.pages ?? []}
                />
            </section>

            <SecSourceDialog onClose={() => setTarget(null)} target={target} />
        </div>
    );
}
