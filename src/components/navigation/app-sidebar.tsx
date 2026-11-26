import type { LucideIcon } from "lucide-react";

import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { ArrowUpRightIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";

import type { InstrumentSectionGroup, NavGroup, NavPage } from "@/lib/navigation";

import { ApiStatusDot } from "@/components/reference/api-status";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_LABELS } from "@/lib/account";
import { isNotFound } from "@/lib/api/errors";
import { useInstrument, useKeyState, useV2Filer, useV2FilingsInfinite, useV2LiveEvents, useV2Person } from "@/lib/api/queries";
import { V2_FILER_EXPANDS } from "@/lib/api/v2";
import { INVINITE_APP_URL } from "@/lib/app-url";
import { brandIconHref } from "@/lib/brand";
import { isSymbolParam } from "@/lib/instruments";
import {
    ACCOUNT_NAV,
    FILER_FILINGS_PAGE,
    filerContextAnchors,
    filerSubjectLabel,
    HELP_NAV,
    instrumentSectionGroups,
    instrumentSubjectLabel,
    isManagerFiler,
    NAV_GROUPS,
    navGroupOfPath,
    OPEN_LISTING_ICON,
    PERSON_CONTEXT_ANCHORS,
} from "@/lib/navigation";
import { PERSON_ID_PATTERN, personSubjectLabel } from "@/lib/people";
import { STATUS_PAGE_URL } from "@/lib/public-hosts";
import { useSidebarGroupsStore } from "@/lib/stores/sidebar-groups-store";
import { selectRecents, useTickerStore } from "@/lib/stores/ticker-store";
import { cn } from "@/lib/utils";
import { LiveDot } from "@/routes/$ticker/earnings-calls/-components/live-dot";

// 32 px rows (36 px below 640 px); the active row (TanStack `Link`: `data-status="active"` + `aria-current="page"`) is
// filled and marked by a 2 px brand bar on its left.
const linkClass = cn(
    "ring-sidebar-ring hover-fill hover:bg-sidebar-accent text-sidebar-foreground/80 relative flex h-8 w-full items-center gap-2 overflow-hidden rounded-[calc(var(--radius-sm)+2px)] px-2 text-left text-sm outline-hidden focus-visible:ring-2 max-sm:h-9",
    "before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full",
    "data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground data-[status=active]:font-medium data-[status=active]:before:bg-brand",
);

const groupHeaderClass = "ring-sidebar-ring hover-fill hover:bg-sidebar-accent text-sidebar-foreground/70 flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium outline-hidden focus-visible:ring-2 aria-disabled:cursor-default aria-disabled:hover:bg-transparent max-sm:h-9";

function ItemContent({ children, icon: Icon, label }: { children?: React.ReactNode; icon: LucideIcon; label: string }) {
    return (
        <>
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
            {children}
        </>
    );
}

function PageLinks({ liveCount, pages }: { liveCount: number; pages: ReadonlyArray<NavPage> }) {
    return (
        <SidebarMenu>
            {pages.map(page => (
                <SidebarMenuItem key={page.to}>
                    <Link activeOptions={{ exact: page.to === "/", includeSearch: false }} className={linkClass} to={page.to}>
                        <ItemContent icon={page.icon} label={page.label}>
                            {page.to === "/live-calls" && liveCount > 0 && (
                                <span className="ml-auto flex items-center gap-1.5 tabular-nums" data-testid="live-count" title={`${liveCount} calls live now`}>
                                    <LiveDot />
                                    {liveCount}
                                </span>
                            )}
                        </ItemContent>
                    </Link>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    );
}

/**
 * One collapsible group: a header button (`aria-expanded`, ←/→ collapse / expand) and its pages, not rendered while
 * collapsed. The group of the current page stays open (`aria-disabled` header). A collapsed group holding Live calls
 * shows the live dot while a call is live.
 */
function NavGroupSection({ current, group, liveCount, onOpenChange, open }: {
    current: boolean;
    group: NavGroup;
    liveCount: number;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    const contentId = `sidebar-group-${group.id}`;

    const liveHidden = !open && liveCount > 0 && group.pages.some(page => page.to === "/live-calls");

    return (
        <SidebarGroup className="py-0.5">
            <button
                aria-controls={contentId}
                aria-disabled={current || undefined}
                aria-expanded={open}
                className={groupHeaderClass}
                onClick={() => !current && onOpenChange(!open)}
                onKeyDown={(event) => {
                    if (current) return;

                    if (event.key === "ArrowLeft" && open) {
                        event.preventDefault();

                        onOpenChange(false);
                    }

                    if (event.key === "ArrowRight" && !open) {
                        event.preventDefault();

                        onOpenChange(true);
                    }
                }}
                title={current ? "Holds the current page" : undefined}
                type="button"
            >
                <span className="truncate">{group.label}</span>
                {liveHidden && (
                    <span aria-label={`${liveCount} calls live now`} className="flex items-center" data-testid="group-live-dot" role="img" title={`${liveCount} calls live now`}>
                        <LiveDot />
                    </span>
                )}
                <ChevronRightIcon aria-hidden className={cn("ml-auto size-4 shrink-0 transition-transform", open && "rotate-90")} />
            </button>
            <SidebarGroupContent id={contentId}>
                {open && <PageLinks liveCount={liveCount} pages={group.pages} />}
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

function SkeletonRows() {
    return (
        <SidebarMenu data-testid="context-skeleton">
            {/* Fixed widths (the primitive's random width differs between the server and the client render). */}
            {["w-3/4", "w-2/3", "w-4/5", "w-1/2"].map(width => (
                <SidebarMenuItem className="flex h-8 items-center gap-2 px-2" key={width}>
                    <Skeleton className="size-4 rounded-md" />
                    <Skeleton className={cn("h-4", width)} />
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    );
}

/** The open instrument's sections by its `datasets`, grouped (a single-item group shows no sub-label). */
function InstrumentContext({ enabled, ticker }: { enabled: boolean; ticker: string }) {
    const { data: instrument, error, isLoading } = useInstrument(enabled ? ticker : "");

    // As the layout: a 404, or a segment no symbol can be (asked nothing) — no context.
    if (!isSymbolParam(ticker) || isNotFound(error)) return null;

    // A failed read (not a 404) shows every section: the page renders the error.
    const groups: Array<InstrumentSectionGroup> = isLoading || !enabled ? [] : instrumentSectionGroups(instrument?.datasets ?? null);

    const label = instrument ? instrumentSubjectLabel(instrument) : ticker.toUpperCase();

    return (
        <SidebarGroup data-testid="sidebar-context">
            <SidebarGroupLabel className="text-sidebar-foreground text-data gap-2 font-semibold normal-case" title={label}>
                {instrument?.logo_url && (
                    <img alt="" className="size-5 shrink-0 rounded-sm bg-white object-contain" height={20} src={instrument.logo_url} width={20} />
                )}
                <span className="truncate">{label}</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
                {groups.length === 0
                    ? <SkeletonRows />
                    : (
                            <SidebarMenu>
                                {groups.map(group => (
                                    <React.Fragment key={group.label}>
                                        {group.items.length > 1 && (
                                            <li className="text-sidebar-foreground/60 px-2 pt-2 pb-0.5 text-xs">{group.label}</li>
                                        )}
                                        {group.items.map(item => (
                                            <SidebarMenuItem key={item.to}>
                                                <Link activeOptions={{ exact: item.section === "", includeSearch: false }} className={linkClass} params={{ ticker }} to={item.to}>
                                                    <ItemContent icon={item.icon} label={item.label} />
                                                </Link>
                                            </SidebarMenuItem>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </SidebarMenu>
                        )}
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

/** The open filer's blocks as in-page anchors (the same `/v1/filers/{cik}` and filings answers as the page). */
function FilerContext({ cik, enabled }: { cik: string; enabled: boolean }) {
    const filer = useV2Filer(enabled ? cik : "", V2_FILER_EXPANDS);

    const filings = useV2FilingsInfinite({ limit: FILER_FILINGS_PAGE, symbol: enabled ? cik : "" });

    const facet = (filings.data?.pages[0]?.meta.form_facet ?? []).map(entry => entry.form);

    const isManager = isManagerFiler(filer.data, facet);

    const anchors = filerContextAnchors(filer.data, isManager);

    const listing = filer.data?.listing ?? null;

    const label = filerSubjectLabel(filer.data?.name, cik, isManager);

    return (
        <SidebarGroup data-testid="sidebar-context">
            <SidebarGroupLabel className="text-sidebar-foreground text-data font-semibold normal-case" title={label}>
                <span className="truncate">{label}</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
                {filer.isLoading || !enabled
                    ? <SkeletonRows />
                    : (
                            <SidebarMenu>
                                {anchors.map(anchor => (
                                    <SidebarMenuItem key={anchor.id}>
                                        <a className={linkClass} href={`#${anchor.id}`}>
                                            <ItemContent icon={anchor.icon} label={anchor.label} />
                                        </a>
                                    </SidebarMenuItem>
                                ))}
                                {listing && (
                                    <SidebarMenuItem>
                                        <Link className={linkClass} params={{ ticker: listing.ticker }} to="/$ticker">
                                            <ItemContent icon={OPEN_LISTING_ICON} label={`Open ${listing.ticker}`} />
                                        </Link>
                                    </SidebarMenuItem>
                                )}
                            </SidebarMenu>
                        )}
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

/** The open person's blocks as in-page anchors (the same `/v1/people/{person_id}` answer as the page). */
function PersonContext({ enabled, personId }: { enabled: boolean; personId: string }) {
    const person = useV2Person(enabled ? personId : "");

    const label = personSubjectLabel(person.data);

    return (
        <SidebarGroup data-testid="sidebar-context">
            <SidebarGroupLabel className="text-sidebar-foreground text-data font-semibold normal-case" title={label}>
                <span className="truncate">{label}</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
                {person.isLoading || !enabled
                    ? <SkeletonRows />
                    : (
                            <SidebarMenu>
                                {PERSON_CONTEXT_ANCHORS.map(anchor => (
                                    <SidebarMenuItem key={anchor.id}>
                                        <a className={linkClass} href={`#${anchor.id}`}>
                                            <ItemContent icon={anchor.icon} label={anchor.label} />
                                        </a>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        )}
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

/**
 * The one sidebar of every page (root layout, ui-redesign task 4): the open subject's context first (an instrument's
 * sections by its `datasets`, a filer's or a person's blocks), then the collapsible `NAV_GROUPS` (open state stored per
 * browser; the current page's group always open), and a footer with API status / licensing, the account with its plan
 * and — below 640 px — the theme switch. Every entry comes from `src/lib/navigation.ts`. Only the public status
 * snapshot is requested before the key answers `/v1/me`.
 */
export function AppSidebar() {
    const params = useParams({ strict: false });

    const pathname = useRouterState({ select: state => state.location.pathname });

    const { me, state } = useKeyState();

    const keyReady = state === "ready";

    const { data: live } = useV2LiveEvents(keyReady);

    const liveCount = live?.data.length ?? 0;

    const cik = params.cik && /^\d{1,10}$/.test(params.cik) ? String(Number(params.cik)) : null;

    const personId = params.personId && PERSON_ID_PATTERN.test(params.personId) ? params.personId.toLowerCase() : null;

    const hydrated = useSidebarGroupsStore(store => store.hasHydrated);

    const stored = useSidebarGroupsStore(store => store.open);

    const setGroupOpen = useSidebarGroupsStore(store => store.setGroupOpen);

    // The stored choices apply after mount (server and first client render show each group's default).
    React.useEffect(() => {
        void useSidebarGroupsStore.persist.rehydrate();
    }, []);

    const currentGroupId = navGroupOfPath(pathname)?.id ?? null;

    // The last opened instrument (recents, newest first): kept in the sidebar on a page without a subject, so one click
    // goes back to it.
    const lastInstrument = useTickerStore(store => selectRecents(store).find(subject => subject.kind === "instrument")?.ref ?? null);

    // The subject's context once the key answered (no key: the onboarding card, no context to load).
    const context = state === "invalid"
        ? null
        : params.ticker
            ? <InstrumentContext enabled={keyReady} ticker={params.ticker} />
            : cik
                ? <FilerContext cik={cik} enabled={keyReady} />
                : personId
                    ? <PersonContext enabled={keyReady} personId={personId} />
                    : lastInstrument ? <InstrumentContext enabled={keyReady} ticker={lastInstrument} /> : null;

    return (
        <Sidebar className="border-sidebar-border [&>div]:bg-background">
            {/* The app's navigation landmark (docked, and inside the off-canvas sheet below 1024 px). */}
            <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col">
                {/* Below 640 px the top bar shows no brand: the off-canvas sidebar does. */}
                <SidebarHeader className="border-sidebar-border border-b px-4 py-3 sm:hidden">
                    <a aria-label="Invinite Data" className="flex cursor-pointer! items-center gap-2" href={INVINITE_APP_URL}>
                        <img alt="" className="size-6" height={24} src={brandIconHref("/brand/icon.svg")} width={24} />
                        <span className="text-sm font-semibold tracking-tight">Invinite Data</span>
                    </a>
                </SidebarHeader>
                <SidebarContent className="py-1">
                    {NAV_GROUPS.map((group) => {
                        const current = group.id === currentGroupId;

                        const open = current || (hydrated ? stored[group.id] ?? group.defaultOpen : group.defaultOpen);

                        return (
                            <NavGroupSection
                                current={current}
                                group={group}
                                key={group.id}
                                liveCount={liveCount}
                                onOpenChange={next => setGroupOpen(group.id, next)}
                                open={open}
                            />
                        );
                    })}
                    {context && (
                        // The subject's sections (only on an instrument, filer or person page) under the groups that
                        // are always there, a hairline between them; they scroll with the groups.
                        <div className="border-sidebar-border mt-1 shrink-0 border-t pt-1">
                            {context}
                        </div>
                    )}
                </SidebarContent>
                <SidebarFooter className="border-sidebar-border gap-1 border-t">
                    <SidebarMenu className="flex-row flex-wrap gap-1" data-testid="sidebar-help">
                        {HELP_NAV.map(link => (
                            <SidebarMenuItem className="min-w-0 flex-1" key={link.href}>
                                <a className={cn(linkClass, "text-xs")} href={link.href} rel="noreferrer" target="_blank">
                                    <span className="truncate">{link.label}</span>
                                    {link.href === STATUS_PAGE_URL
                                        ? <ApiStatusDot />
                                        : <ArrowUpRightIcon aria-hidden className="size-3.5 shrink-0" />}
                                </a>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                    <SidebarMenu>
                        <SidebarMenuItem className="flex items-center gap-1">
                            <Link className={cn(linkClass, "min-w-0 flex-1")} to={ACCOUNT_NAV.to}>
                                <ItemContent icon={ACCOUNT_NAV.icon} label={ACCOUNT_NAV.label}>
                                    {me && <Badge className="ml-auto" variant="secondary">{PLAN_LABELS[me.plan]}</Badge>}
                                </ItemContent>
                            </Link>
                            {/* Below 640 px the top bar has no theme switch: it is here. */}
                            <div className="sm:hidden">
                                <ThemeToggle />
                            </div>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            </nav>
        </Sidebar>
    );
}
