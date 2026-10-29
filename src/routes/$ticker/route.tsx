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
    SplitIcon,
    UserRoundIcon,
} from "lucide-react";

import { ErrorState } from "@/components/ui/error-state";
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
import { useCompanyDetails } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$ticker")({
    component: TickerLayout,
});

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
    { icon: CoinsIcon, label: "Dividends", to: "/$ticker/dividends" },
    { icon: SplitIcon, label: "Stock Splits", to: "/$ticker/stock-splits" },
    { icon: UserRoundIcon, label: "Insider Trades", to: "/$ticker/insider-trades" },
    { icon: Building2Icon, label: "Institutions", to: "/$ticker/institutions" },
    { icon: CalendarDaysIcon, label: "Earnings Calendar", to: "/$ticker/earnings-calendar" },
    { icon: Building2Icon, label: "IPOs", to: "/$ticker/ipos" },
    { icon: CalendarDaysIcon, label: "Market Holidays", to: "/$ticker/market-holidays" },
] as const;

const marketStart = navItems.findIndex(item => item.label === "Earnings Calendar");

const companyNavItems = navItems.slice(0, marketStart);

const marketNavItems = navItems.slice(marketStart);

function TickerLayout() {
    const { ticker } = Route.useParams();

    const pathname = useRouterState({ select: state => state.location.pathname });

    const marketPaths = marketNavItems.map(item => item.to.replace("$ticker", ticker));

    const isMarketRoute = marketPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));

    const { data, error } = useCompanyDetails(ticker);

    const company = data?.companies[0];

    return (
        <>
            <Sidebar className="group-data-[side=left]:border-none [&>div]:bg-background">
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel className="mt-7">Company</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {companyNavItems.map(item => (
                                    <SidebarMenuItem key={item.to}>
                                        <Link
                                            activeOptions={{ exact: item.to === "/$ticker" }}
                                            className={cn(
                                                "ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80 flex h-8 w-full items-center gap-2 overflow-hidden rounded-[calc(var(--radius-sm)+2px)] px-2 text-left text-xs outline-hidden transition-colors focus-visible:ring-2",
                                                "data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground data-[status=active]:font-medium",
                                            )}
                                            params={{ ticker }}
                                            to={item.to}
                                        >
                                            <item.icon className="size-4 shrink-0" />
                                            <span className="truncate">{item.label}</span>
                                        </Link>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                    <SidebarGroup>
                        <SidebarGroupLabel>Market</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {marketNavItems.map(item => (
                                    <SidebarMenuItem key={item.to}>
                                        <Link
                                            activeOptions={{ exact: item.to === "/$ticker" }}
                                            className={cn(
                                                "ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80 flex h-8 w-full items-center gap-2 overflow-hidden rounded-[calc(var(--radius-sm)+2px)] px-2 text-left text-xs outline-hidden transition-colors focus-visible:ring-2",
                                                "data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground data-[status=active]:font-medium",
                                            )}
                                            params={{ ticker }}
                                            to={item.to}
                                        >
                                            <item.icon className="size-4 shrink-0" />
                                            <span className="truncate">{item.label}</span>
                                        </Link>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>

            <div className="relative h-full grow flex flex-col">
                <SidebarInset>
                    <div className="mx-auto flex w-full h-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-8">
                        {!isMarketRoute && (
                            <header className="flex flex-col gap-2">
                                <div className="flex items-center gap-3">
                                    {company?.logo_url && (
                                        <img
                                            alt={`${ticker} logo`}
                                            className="bg-muted ring-border/60 h-9 w-9 rounded-md object-contain ring-1"
                                            src={company.logo_url}
                                        />
                                    )}
                                    <h1 className="text-3xl font-bold tracking-tight">{ticker}</h1>
                                    {company && (
                                        <span className="text-muted-foreground text-lg">{company.name}</span>
                                    )}
                                    {company?.brand_colors && company.brand_colors.length > 0 && (
                                        <div className="flex items-center gap-1.5 ml-2">
                                            {company.brand_colors.map((color, index) => (
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

                        {error && (
                            <ErrorState error={error} title="Failed to load company header details" />
                        )}

                        <Outlet />
                    </div>
                </SidebarInset>
            </div>
        </>
    );
}
