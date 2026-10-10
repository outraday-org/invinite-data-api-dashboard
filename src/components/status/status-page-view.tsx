import * as React from "react";

import type { ApiStatusResponse, EarningsCallsStatusResponse } from "@/lib/api/types";
import type { StatusWindow } from "@/lib/status/search";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError } from "@/lib/api/errors";
import { describeEarningsScope, formatUtcDateTime } from "@/lib/status/labels";
import { STATUS_WINDOWS } from "@/lib/status/search";

import { ApiSection } from "./api-section";
import { StatePanel } from "./chart-parts";
import { EarningsSection } from "./earnings-section";
import { FreshnessSection } from "./freshness-section";

export type QueryState<T> = {
    data: null | T;
    error: unknown;
    isLoading: boolean;
};

export type StatusPageViewProps = {
    days: StatusWindow;
    earnings: QueryState<EarningsCallsStatusResponse>;
    onDaysChange: (days: StatusWindow) => void;
    onVendorChange: (vendor: string) => void;
    status: QueryState<ApiStatusResponse>;
    vendor: string;
};

/** A 503 `status_unavailable`: the deployment publishes no earnings SLO (a state, not an error). */
export function isStatusUnpublished(error: unknown) {
    return error instanceof ApiRequestError && error.code === "status_unavailable";
}

function SectionHeader({ meta, title }: { meta?: React.ReactNode; title: string }) {
    return (
        <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {meta && <p className="text-muted-foreground text-xs">{meta}</p>}
        </div>
    );
}

function SectionSkeleton() {
    return (
        <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    );
}

function WindowSelector({ days, onChange }: { days: StatusWindow; onChange: (days: StatusWindow) => void }) {
    return (
        <div aria-label="Window" className="flex gap-1" role="group">
            {STATUS_WINDOWS.map(window => (
                <Button
                    aria-pressed={window === days}
                    key={window}
                    onClick={() => onChange(window)}
                    size="sm"
                    variant={window === days ? "secondary" : "ghost"}
                >
                    {`${window} days`}
                </Button>
            ))}
        </div>
    );
}

function EarningsBody({ earnings, onVendorChange, vendor }: Pick<StatusPageViewProps, "earnings" | "onVendorChange" | "vendor">) {
    if (earnings.isLoading) return <SectionSkeleton />;

    if (isStatusUnpublished(earnings.error)) {
        return <StatePanel>Earnings-call status not published for this deployment</StatePanel>;
    }

    if (earnings.error) return <ErrorState error={earnings.error} title="Earnings-call status failed to load" />;

    if (!earnings.data) return null;

    return <EarningsSection earnings={earnings.data} onVendorChange={onVendorChange} vendor={vendor} />;
}

/** The public status page, prop-driven (the route only wires the search params and queries). */
export function StatusPageView({ days, earnings, onDaysChange, onVendorChange, status, vendor }: StatusPageViewProps) {
    const universe = status.data?.universe;

    const scope = describeEarningsScope(universe?.earnings_calls.scope ?? earnings.data?.coverage.scope ?? "unknown");

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 lg:px-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <p className="text-primary text-xs tracking-[0.2em] uppercase">Invinite API</p>
                    <h1 className="text-3xl font-bold tracking-tight">API status</h1>
                    {typeof universe?.companies === "number" && (
                        <p className="text-muted-foreground text-sm">
                            {`${universe.companies.toLocaleString("en")} US-listed companies`}
                        </p>
                    )}
                </div>
                <WindowSelector days={days} onChange={onDaysChange} />
            </header>

            <section aria-labelledby="status-api" className="space-y-4">
                <div id="status-api">
                    <SectionHeader
                        meta={status.data ? `Generated ${formatUtcDateTime(status.data.generated_at)} · updated continuously` : undefined}
                        title="API"
                    />
                </div>
                {status.isLoading && <SectionSkeleton />}
                {!status.isLoading && !status.data && (
                    <ErrorState error={status.error ?? "No response"} title="API status failed to load" />
                )}
                {status.data && <ApiSection status={status.data} />}
            </section>

            <section aria-labelledby="status-freshness" className="space-y-4">
                <div id="status-freshness">
                    <SectionHeader meta="Newest ingest per dataset" title="Data freshness" />
                </div>
                {status.isLoading && <SectionSkeleton />}
                {!status.isLoading && !status.data && <StatePanel>Freshness unavailable</StatePanel>}
                {status.data && <FreshnessSection freshness={status.data.freshness} />}
            </section>

            <section aria-labelledby="status-earnings" className="space-y-4">
                <div id="status-earnings">
                    <SectionHeader
                        meta={[
                            scope ? `Covering ${scope}` : null,
                            earnings.data ? `Generated ${formatUtcDateTime(earnings.data.generatedAt)} · updated daily` : null,
                        ].filter(Boolean).join(" · ") || undefined}
                        title="Earnings calls"
                    />
                </div>
                <EarningsBody earnings={earnings} onVendorChange={onVendorChange} vendor={vendor} />
                <p className="text-muted-foreground text-xs">
                    Updated daily; the newest day is yesterday. This page is meant to be cached by browsers and CDNs, not polled.
                </p>
            </section>
        </div>
    );
}
