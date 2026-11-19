import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
    BarChart3Icon,
    Building2Icon,
    CalendarDaysIcon,
    CoinsIcon,
    FileTextIcon,
    FolderOpenIcon,
    LayoutDashboardIcon,
    MicIcon,
    NewspaperIcon,
    PieChartIcon,
    SplitIcon,
    UserRoundIcon,
} from "lucide-react";

import type { V2Dataset, V2Instrument } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarInset,
    SidebarMenu,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ApiRequestError } from "@/lib/api/errors";
import { useFund, useInstrument, useV2Company } from "@/lib/api/queries";
import { datasetGateText, instrumentBadges, isFundType, SECTION_DATASETS, sectionOf, servesSection } from "@/lib/instruments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$ticker")({
    component: TickerLayout,
});

/**
 * Every section of `/$ticker`. Which ones the sidebar shows comes from the instrument's `datasets` (Data API 7.0) through
 * `SECTION_DATASETS` (`src/lib/instruments.ts`, the section → dataset table); the dashboard keeps no per-type list.
 * The market-wide sections (dataset `null`) show for every ticker.
 */
const navItems = [
    { icon: LayoutDashboardIcon, label: "Overview", to: "/$ticker" },
    { icon: FileTextIcon, label: "Filings", to: "/$ticker/filings" },
    { icon: MicIcon, label: "Earnings Calls", to: "/$ticker/earnings-calls" },
    { icon: FolderOpenIcon, label: "Documents", to: "/$ticker/documents" },
    { icon: NewspaperIcon, label: "News", to: "/$ticker/news" },
    { icon: BarChart3Icon, label: "Standardized Financials", to: "/$ticker/financials-standardized" },
    { icon: BarChart3Icon, label: "As Reported Financials", to: "/$ticker/financials-as-reported" },
    { icon: BarChart3Icon, label: "CAGR Financials", to: "/$ticker/financials-cagr" },
    { icon: BarChart3Icon, label: "Growth Financials", to: "/$ticker/financials-growth" },
    { icon: BarChart3Icon, label: "Ratio Financials", to: "/$ticker/financials-ratios" },
    { icon: BarChart3Icon, label: "Segmented Financials", to: "/$ticker/segmented-financials" },
    { icon: PieChartIcon, label: "Holdings", to: "/$ticker/holdings" },
    { icon: CoinsIcon, label: "Dividends", to: "/$ticker/dividends" },
    { icon: SplitIcon, label: "Splits", to: "/$ticker/stock-splits" },
    { icon: UserRoundIcon, label: "Insider Trades", to: "/$ticker/insider-trades" },
    { icon: Building2Icon, label: "Holders", to: "/$ticker/holders" },
    { icon: CalendarDaysIcon, label: "Earnings Calendar", to: "/$ticker/earnings-calendar" },
    { icon: Building2Icon, label: "IPOs", to: "/$ticker/ipos" },
    { icon: CalendarDaysIcon, label: "Market Holidays", to: "/$ticker/market-holidays" },
] as const;

type NavItem = (typeof navItems)[number];

/** The section of a nav item's path ("" = the overview). */
const sectionOfItem = (item: NavItem) => item.to.split("/")[2] ?? "";

const marketNavItems = navItems.filter(item => SECTION_DATASETS[sectionOfItem(item)] === null);

const instrumentNavItems = navItems.filter(item => SECTION_DATASETS[sectionOfItem(item)] !== null);

/** The instrument sections an answer allows: by `datasets`; every one when the instrument could not be read (not a 404). */
export function visibleInstrumentItems(datasets: null | ReadonlyArray<V2Dataset>): Array<NavItem> {
    if (datasets === null) return [...instrumentNavItems];

    return instrumentNavItems.filter(item => servesSection(datasets, sectionOfItem(item)));
}

const groupLabel = (instrument: null | V2Instrument) => {
    if (!instrument || instrument.type === "stock") return "Company";

    return isFundType(instrument.type) ? "Fund" : "Note";
};

const linkClass = cn(
    "ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80 flex h-8 w-full items-center gap-2 overflow-hidden rounded-[calc(var(--radius-sm)+2px)] px-2 text-left text-xs outline-hidden transition-colors focus-visible:ring-2",
    "data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground data-[status=active]:font-medium",
);

function NavLinks({ items, ticker }: { items: ReadonlyArray<NavItem>; ticker: string }) {
    return (
        <SidebarMenu>
            {items.map(item => (
                <SidebarMenuItem key={item.to}>
                    <Link activeOptions={{ exact: item.to === "/$ticker" }} className={linkClass} params={{ ticker }} to={item.to}>
                        <item.icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                    </Link>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    );
}

/**
 * The layout of every `/$ticker` page. It reads the instrument once (`GET /v1/instruments/{symbol}`): the header (name,
 * logo, type badge) and the sidebar (only the sections its `datasets` has). A symbol the API does not know renders one
 * "not known" notice instead of the pages; a section the instrument has no data family for (a typed URL) renders the
 * reason instead of a failing page. The market-wide pages render under any ticker.
 */
function TickerLayout() {
    const { ticker } = Route.useParams();

    const pathname = useRouterState({ select: state => state.location.pathname });

    const section = sectionOf(pathname) ?? "";

    const isMarketRoute = SECTION_DATASETS[section] === null;

    const { data: instrument, error, isLoading } = useInstrument(ticker);

    const isUnknown = error instanceof ApiRequestError && error.status === 404;

    // Brand colours live on the company (stock) or the fund profile; the overview reads the same answers.
    const { data: company } = useV2Company(instrument?.type === "stock" ? ticker : "");

    const { data: fund } = useFund(instrument && isFundType(instrument.type) ? ticker : "");

    const brandColors = company?.brand_colors ?? fund?.brand_colors ?? [];

    const items = isLoading || isUnknown ? [] : visibleInstrumentItems(instrument?.datasets ?? null);

    const gatedDataset = instrument && !isMarketRoute && !servesSection(instrument.datasets, section) ? SECTION_DATASETS[section] : null;

    return (
        <>
            <Sidebar className="group-data-[side=left]:border-none [&>div]:bg-background">
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel className="mt-7">{groupLabel(instrument)}</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <NavLinks items={items} ticker={ticker} />
                        </SidebarGroupContent>
                    </SidebarGroup>
                    <SidebarGroup>
                        <SidebarGroupLabel>Market</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <NavLinks items={marketNavItems} ticker={ticker} />
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>

            <div className="relative h-full grow flex flex-col">
                <SidebarInset>
                    <div className="mx-auto flex w-full h-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-8">
                        {!isMarketRoute && !isUnknown && (
                            <header className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-3">
                                    {instrument?.logo_url && (
                                        <img
                                            alt={`${ticker} logo`}
                                            className="bg-muted ring-border/60 h-9 w-9 rounded-md object-contain ring-1"
                                            src={instrument.logo_url}
                                        />
                                    )}
                                    <h1 className="text-3xl font-bold tracking-tight">{ticker}</h1>
                                    {instrument && (
                                        <span className="text-muted-foreground text-lg">{instrument.name}</span>
                                    )}
                                    {instrument && instrumentBadges(instrument).map(badge => (
                                        <Badge data-testid="instrument-badge" key={badge} variant="secondary">{badge}</Badge>
                                    ))}
                                    {brandColors.length > 0 && (
                                        <div className="flex items-center gap-1.5 ml-2">
                                            {brandColors.map((color, index) => (
                                                <div
                                                    className="size-5 rounded-full ring-1 ring-border/60"
                                                    key={index}
                                                    style={{ backgroundColor: color }}
                                                    title={color}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </header>
                        )}

                        {!isMarketRoute && error && !isUnknown && (
                            <ErrorState error={error} title="Failed to load the instrument" />
                        )}

                        {!isMarketRoute && isUnknown
                            ? (
                                    <Notice badge="Not known" title={`${ticker.toUpperCase()} is not a known instrument`}>
                                        {error.message}
                                    </Notice>
                                )
                            : !isMarketRoute && instrument && gatedDataset
                                    ? <Notice badge="Not served" title={datasetGateText(instrument, gatedDataset)} />
                                    : <Outlet />}
                    </div>
                </SidebarInset>
            </div>
        </>
    );
}
