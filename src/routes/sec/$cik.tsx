import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";

import { SecFilerHeader, SecFilingsView, SecLifecycleView, SecPortfolioView } from "@/components/sec/sec-filer-views";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { Button } from "@/components/ui/button";
import { NotFound } from "@/components/ui/not-found";
import { useV2Filer, useV2FilingsInfinite, useV2HoldingsInfinite } from "@/lib/api/queries";
import { V2_FILER_EXPANDS } from "@/lib/api/v2";
import { latest13fPeriodEnd } from "@/lib/sec/source";

/**
 * One SEC filer by CIK — outside `$ticker` on purpose: a pre-IPO issuer, a SPAC or a 13F manager without an exchange
 * listing has no ticker, and none is invented (no asset row, no fake `$ticker`). Reached from the landing page's filer
 * lookup (`/v1/filers?q=`) and the company overview's CIK. Identity + lifecycle = one `GET /v1/filers/{cik}` with every
 * expansion; the filings = `GET /v1/filings?company=<cik>`; a 13F manager's portfolio = `GET /v1/holdings?filer=<cik>`
 * for one quarter, asked on a click.
 */
export const Route = createFileRoute("/sec/$cik")({
    component: SecFilerPage,
});

const FILINGS_PAGE = 40;

const PORTFOLIO_PAGE = 25;

const MANAGER_FORMS = new Set(["13F-HR", "13F-HR/A", "13F-NT", "13F-NT/A"]);

function SecFilerPage() {
    const { cik: rawCik } = Route.useParams();

    const cik = /^\d{1,10}$/.test(rawCik) ? String(Number(rawCik)) : "";

    const [form, setForm] = React.useState<null | string>(null);

    const [target, setTarget] = React.useState<null | SecPanelTarget>(null);

    // The 13F portfolio costs a request: asked on a click, for the newest quarter whose reports are due.
    const [period, setPeriod] = React.useState<null | string>(null);

    const filer = useV2Filer(cik, V2_FILER_EXPANDS);

    const filings = useV2FilingsInfinite({ company: cik, form: form ? [form] : undefined, limit: FILINGS_PAGE });

    // Idle (no scope) until a quarter is picked.
    const portfolio = useV2HoldingsInfinite({ filer: period ? cik : undefined, limit: PORTFOLIO_PAGE, periodEnd: period ?? undefined });

    if (!cik) return <NotFound />;

    const facet = filings.data?.pages[0]?.meta.form_facet ?? [];

    const isManager = filer.data?.phase === "manager" || facet.some(entry => MANAGER_FORMS.has(entry.form));

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-8">
            <SecFilerHeader cik={cik} data={filer.data} error={filer.error} isLoading={filer.isLoading} />

            <section className="flex flex-col gap-2">
                <div className="font-medium">Lifecycle</div>
                <SecLifecycleView data={filer.data} error={filer.error} isLoading={filer.isLoading} />
            </section>

            {isManager && (
                <section className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="font-medium">13F portfolio</div>
                        {!period && (
                            <Button onClick={() => setPeriod(latest13fPeriodEnd(new Date()))} size="xs" type="button" variant="outline">
                                Load the latest quarter
                            </Button>
                        )}
                        {period && <span className="text-muted-foreground text-xs">{`Period ending ${period}`}</span>}
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

            <section className="flex flex-col gap-2">
                <div className="font-medium">Filings</div>
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
