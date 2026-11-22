import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError } from "@/lib/api/errors";
import { useInstrument } from "@/lib/api/queries";
import { datasetGateText, instrumentBadges, isSymbolParam, sectionDatasets, sectionOf, servesSection, SYMBOL_MAX_LENGTH } from "@/lib/instruments";
import { TICKER_HEADER_HEIGHT_VAR, titleHead } from "@/lib/layout";
import { recentInstrument, useRecordRecent } from "@/lib/recents";

export const Route = createFileRoute("/$ticker")({
    component: TickerLayout,
    head: ({ params }) => titleHead(params.ticker.toUpperCase()),
});

/**
 * Publishes the pinned instrument header's height as `--ticker-header-height` on `<html>` (sticky table headers and the
 * call player sit below it); `0px` when the header is gone (an unknown symbol, leaving the layout).
 */
function useTickerHeaderHeight(header: React.RefObject<HTMLElement | null>, shown: boolean) {
    React.useEffect(() => {
        const root = document.documentElement;

        const element = header.current;

        if (!shown || !element) {
            root.style.setProperty(TICKER_HEADER_HEIGHT_VAR, "0px");

            return;
        }

        const publish = () => root.style.setProperty(TICKER_HEADER_HEIGHT_VAR, `${element.getBoundingClientRect().height}px`);

        publish();

        if (typeof ResizeObserver === "undefined") return () => root.style.setProperty(TICKER_HEADER_HEIGHT_VAR, "0px");

        const observer = new ResizeObserver(publish);

        observer.observe(element);

        return () => {
            observer.disconnect();

            root.style.setProperty(TICKER_HEADER_HEIGHT_VAR, "0px");
        };
    }, [header, shown]);
}

/**
 * The layout of every `/$ticker` page. It reads the instrument once (`GET /v1/instruments/{symbol}`): the pinned header
 * (name, logo, type badges); the sidebar's context part (root layout) reads the same answer. A symbol the API does not
 * know renders one "not known" notice instead of the pages; a section the instrument has no data family for (a typed
 * URL) renders the reason instead of a failing page.
 */
function TickerLayout() {
    const { ticker } = Route.useParams();

    const pathname = useRouterState({ select: state => state.location.pathname });

    const section = sectionOf(pathname) ?? "";

    const { data: instrument, error, isLoading } = useInstrument(ticker);

    // A segment no symbol can be (longer than any) is not known without a request (UI walk F008).
    const notSymbol = !isSymbolParam(ticker);

    const isUnknown = notSymbol || (error instanceof ApiRequestError && error.status === 404);

    const gatedDatasets = instrument && !servesSection(instrument.datasets, section) ? sectionDatasets(section) : [];

    const showHeader = !isUnknown;

    const headerRef = React.useRef<HTMLElement>(null);

    useTickerHeaderHeight(headerRef, showHeader);

    useRecordRecent(instrument ? recentInstrument(instrument) : null);

    // The canonical symbol of the answer (BRK.B for a typed brk.b), not the raw URL param.
    const symbol = instrument?.symbol ?? ticker.toUpperCase();

    // A section mounts (and requests) only once the instrument is known: no gated page asks the API while the
    // instrument loads, and no refusal flashes before the gate sentence ([FU2870], [FU2838]). A failed instrument read
    // (not a 404) still renders the page under the error.
    let body: React.ReactNode;

    if (isUnknown) {
        body = (
            <Notice badge="Not known" title={`${ticker.toUpperCase()} is not a known instrument`}>
                {notSymbol ? `A symbol has at most ${SYMBOL_MAX_LENGTH} characters.` : error?.message}
            </Notice>
        );
    }
    else if (isLoading) body = <PageSkeleton />;
    else if (instrument && gatedDatasets.length > 0) body = <Notice badge="Not served" title={datasetGateText(instrument, gatedDatasets[0])} />;
    else body = <Outlet />;

    return (
        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 pb-8 lg:px-8">
            {showHeader
                ? (
                        <header
                            className="bg-background/95 supports-backdrop-filter:backdrop-blur sticky top-(--app-topbar-height) z-30 -mx-4 flex flex-col gap-2 px-4 pt-4 pb-3 lg:-mx-8 lg:px-8"
                            ref={headerRef}
                        >
                            <div className="flex flex-wrap items-center gap-3">
                                {instrument?.logo_url && (
                                    <img
                                        alt={`${symbol} logo`}
                                        className="bg-muted ring-border/60 h-9 w-9 rounded-md object-contain ring-1"
                                        src={instrument.logo_url}
                                    />
                                )}
                                <h1 className="text-2xl font-bold tracking-tight">{symbol}</h1>
                                {instrument && (
                                    <span className="text-muted-foreground text-base">{instrument.name}</span>
                                )}
                                {instrument && instrumentBadges(instrument).map(badge => (
                                    <Badge data-testid="instrument-badge" key={badge} variant="secondary">{badge}</Badge>
                                ))}
                            </div>
                        </header>
                    )
                : <div className="pt-4" />}

            {error && !isUnknown && (
                <ErrorState error={error} title="Failed to load the instrument" />
            )}

            {body}
        </div>
    );
}

/** The page placeholder while the instrument loads (no section is mounted yet). */
function PageSkeleton() {
    return (
        <div className="flex flex-col gap-4" data-testid="page-skeleton">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-96 max-w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}
