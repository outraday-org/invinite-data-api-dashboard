import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { PageContainer } from "@/components/ui/page-container";
import { HeadingLevelProvider, PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotFound } from "@/lib/api/errors";
import { useInstrument } from "@/lib/api/queries";
import { datasetGateText, instrumentBadges, isSymbolParam, sectionDatasets, sectionOf, servesSection, SYMBOL_MAX_LENGTH } from "@/lib/instruments";
import { TICKER_HEADER_HEIGHT_VAR, titleHead } from "@/lib/layout";
import { recentInstrument, useRecordRecent } from "@/lib/recents";
import { SectionTabs, SectionTabsSkeleton } from "@/routes/$ticker/-components/section-tabs";

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
 * Whether the sentinel (the end of the identity block) has passed under the pinned top bar — the tab row's compact
 * state. An IntersectionObserver, not scroll events; the compact state changes no height, so it cannot toggle itself
 * back.
 */
function useScrolledPast(sentinel: React.RefObject<HTMLElement | null>, enabled: boolean) {
    const [past, setPast] = React.useState(false);

    React.useEffect(() => {
        const element = sentinel.current;

        if (!enabled || !element || typeof IntersectionObserver === "undefined") return;

        const topBar = Number.parseFloat(getComputedStyle(document.body).getPropertyValue("--app-topbar-height")) || 56;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) setPast(!entry.isIntersecting && entry.boundingClientRect.top < topBar);
            },
            { rootMargin: `-${topBar}px 0px 0px 0px` },
        );

        observer.observe(element);

        return () => {
            observer.disconnect();

            setPast(false);
        };
    }, [sentinel, enabled]);

    return past;
}

/**
 * The layout of every `/$ticker` page. It reads the instrument once (`GET /v1/instruments/{symbol}`): the header (logo,
 * symbol, name, type badges, exchange · currency) and the pinned row of section links (`SectionTabs`, the sidebar's
 * context group's twin — both from the same answer's `datasets`). A symbol the API does not
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

    const isUnknown = notSymbol || isNotFound(error);

    const gatedDatasets = instrument && !servesSection(instrument.datasets, section) ? sectionDatasets(section) : [];

    const showHeader = !isUnknown;

    const headerRef = React.useRef<HTMLElement>(null);

    const sentinelRef = React.useRef<HTMLDivElement>(null);

    useTickerHeaderHeight(headerRef, showHeader);

    const compact = useScrolledPast(sentinelRef, showHeader);

    useRecordRecent(instrument ? recentInstrument(instrument) : null);

    // The canonical symbol of the answer (BRK.B for a typed brk.b), not the raw URL param.
    const symbol = instrument?.symbol ?? ticker.toUpperCase();

    // A section mounts (and requests) only once the instrument is known: no gated page asks the API while the
    // instrument loads, and no refusal flashes before the gate sentence ([FU2870], [FU2838]). A failed instrument read
    // (not a 404) still renders the page under the error.
    let body: React.ReactNode;

    if (isUnknown) {
        // No identity header here: the typed symbol is the page's one `h1`.
        body = (
            <>
                <PageHeader level={1} title={ticker.toUpperCase()} />
                <Notice badge="Not known" title={`${ticker.toUpperCase()} is not a known instrument`}>
                    {notSymbol ? `A symbol has at most ${SYMBOL_MAX_LENGTH} characters.` : error?.message}
                </Notice>
            </>
        );
    }
    else if (isLoading) body = <PageSkeleton />;
    else if (instrument && gatedDatasets.length > 0) body = <Notice badge="Not served" title={datasetGateText(instrument, gatedDatasets[0])} />;
    else body = <Outlet />;

    // The identity block scrolls away under the top bar; only the tab row is pinned (its height is the
    // `--ticker-header-height`). The negative margins match the container's `px-4 sm:px-6 xl:px-8` and pull the row
    // up into the container's `gap-6` (identity → tabs 12 px).
    return (
        <PageContainer className="pt-0 sm:pt-0 xl:pt-0">
            {showHeader
                ? (
                        <>
                            <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-4" data-testid="ticker-identity">
                                <div className="flex min-w-0 items-center gap-2.5 max-sm:w-full sm:gap-3">
                                    {instrument?.logo_url && (
                                        <img
                                            alt={`${symbol} logo`}
                                            className="bg-muted ring-border/60 size-7 shrink-0 rounded-md object-contain ring-1 lg:size-9"
                                            src={instrument.logo_url}
                                        />
                                    )}
                                    <h1 className="shrink-0 text-xl font-bold tracking-tight lg:text-2xl">{symbol}</h1>
                                    {instrument?.name && (
                                        <span className="text-muted-foreground min-w-0 truncate text-base" title={instrument.name}>{instrument.name}</span>
                                    )}
                                </div>
                                {instrument && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {instrumentBadges(instrument).map(badge => (
                                            <Badge data-testid="instrument-badge" key={badge} variant="secondary">{badge}</Badge>
                                        ))}
                                    </div>
                                )}
                                {instrument && (
                                    <span className="text-muted-foreground ml-auto hidden text-xs md:inline" data-testid="instrument-meta">
                                        {[instrument.exchange, instrument.currency].filter(Boolean).join(" · ")}
                                    </span>
                                )}
                                {/* The compact state's sentinel: the end of the identity block. */}
                                <div aria-hidden className="absolute inset-x-0 bottom-0 h-px" ref={sentinelRef} />
                            </div>
                            <header
                                className="group/ticker bg-background/95 supports-backdrop-filter:backdrop-blur sticky top-(--app-topbar-height) z-30 -mx-4 -mt-3 flex items-center gap-3 border-b px-4 sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8"
                                data-compact={compact || undefined}
                                data-testid="ticker-header"
                                ref={headerRef}
                            >
                                {/* Compact (scrolled): the symbol joins the tab row; a width change only, the row's height stays. */}
                                <span aria-hidden className="hidden shrink-0 items-center gap-2 text-sm font-semibold group-data-compact/ticker:flex">
                                    {instrument?.logo_url && <img alt="" className="size-5 rounded-sm object-contain" src={instrument.logo_url} />}
                                    {symbol}
                                </span>
                                {isLoading
                                    ? <SectionTabsSkeleton />
                                    : <SectionTabs datasets={instrument?.datasets ?? null} section={section} ticker={ticker} />}
                            </header>
                        </>
                    )
                : <div className="pt-4" />}

            {error && !isUnknown && (
                <ErrorState error={error} title="Failed to load the instrument" />
            )}

            {/* The header's h1 is the symbol: a section's PageHeader title is an h2. */}
            <HeadingLevelProvider value={2}>{body}</HeadingLevelProvider>
        </PageContainer>
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
