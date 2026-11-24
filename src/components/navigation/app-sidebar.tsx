import type { LucideIcon } from "lucide-react";

import { Link, useParams } from "@tanstack/react-router";
import * as React from "react";

import type { InstrumentSectionGroup, NavPage } from "@/lib/navigation";

import { ApiStatusDot } from "@/components/reference/api-status";
import { Badge } from "@/components/ui/badge";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_LABELS } from "@/lib/account";
import { isNotFound } from "@/lib/api/errors";
import { useInstrument, useKeyState, useV2Filer, useV2FilingsInfinite, useV2LiveEvents, useV2Person } from "@/lib/api/queries";
import { V2_FILER_EXPANDS } from "@/lib/api/v2";
import {
    ACCOUNT_NAV,
    BROWSE_NAV,
    FILER_FILINGS_PAGE,
    filerContextAnchors,
    filerSubjectLabel,
    HELP_NAV,
    instrumentSectionGroups,
    instrumentSubjectLabel,
    isManagerFiler,
    MARKET_NAV,
    OPEN_LISTING_ICON,
    PERSON_CONTEXT_ANCHORS,
} from "@/lib/navigation";
import { PERSON_ID_PATTERN, personSubjectLabel } from "@/lib/people";
import { STATUS_PAGE_URL } from "@/lib/public-hosts";
import { cn } from "@/lib/utils";
import { LiveDot } from "@/routes/$ticker/earnings-calls/-components/live-dot";

const linkClass = cn(
    "ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80 flex h-8 w-full items-center gap-2 overflow-hidden rounded-[calc(var(--radius-sm)+2px)] px-2 text-left text-sm outline-hidden transition-colors focus-visible:ring-2",
    "data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground data-[status=active]:font-medium",
);

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

    const isUnknown = isNotFound(error);

    if (isUnknown) return null;

    // A failed read (not a 404) shows every section: the page renders the error.
    const groups: Array<InstrumentSectionGroup> = isLoading || !enabled ? [] : instrumentSectionGroups(instrument?.datasets ?? null);

    const label = instrument ? instrumentSubjectLabel(instrument) : ticker.toUpperCase();

    return (
        <SidebarGroup data-testid="sidebar-context">
            <SidebarGroupLabel className="text-[13px] normal-case">{label}</SidebarGroupLabel>
            <SidebarGroupContent>
                {groups.length === 0
                    ? <SkeletonRows />
                    : (
                            <SidebarMenu>
                                {groups.map(group => (
                                    <React.Fragment key={group.label}>
                                        {group.items.length > 1 && (
                                            <li className="text-sidebar-foreground/60 px-2 pt-2 text-[0.625rem] font-medium uppercase tracking-wide">{group.label}</li>
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

    return (
        <SidebarGroup data-testid="sidebar-context">
            <SidebarGroupLabel className="normal-case">{filerSubjectLabel(filer.data?.name, cik, isManager)}</SidebarGroupLabel>
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

    return (
        <SidebarGroup data-testid="sidebar-context">
            <SidebarGroupLabel className="normal-case">{personSubjectLabel(person.data)}</SidebarGroupLabel>
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
 * The one sidebar of every page (root layout): Market and Browse always, the Context of the open subject (an
 * instrument's sections by its `datasets`, a filer's blocks), Help, and the account with its plan badge. Every entry
 * comes from `src/lib/navigation.ts`. Nothing is requested before the key answered `/v1/me`.
 */
export function AppSidebar() {
    const params = useParams({ strict: false });

    const { me, state } = useKeyState();

    const keyReady = state === "ready";

    const { data: live } = useV2LiveEvents(keyReady);

    const liveCount = live?.data.length ?? 0;

    const cik = params.cik && /^\d{1,10}$/.test(params.cik) ? String(Number(params.cik)) : null;

    const personId = params.personId && PERSON_ID_PATTERN.test(params.personId) ? params.personId.toLowerCase() : null;

    return (
        <Sidebar className="group-data-[side=left]:border-none [&>div]:bg-background">
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Market</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <PageLinks liveCount={liveCount} pages={MARKET_NAV} />
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>Browse</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <PageLinks liveCount={0} pages={BROWSE_NAV} />
                    </SidebarGroupContent>
                </SidebarGroup>
                {/* The subject's context once the key answered (no key: the onboarding card, no context to load). */}
                {params.ticker && state !== "invalid" && <InstrumentContext enabled={keyReady} ticker={params.ticker} />}
                {cik && state !== "invalid" && <FilerContext cik={cik} enabled={keyReady} />}
                {personId && state !== "invalid" && <PersonContext enabled={keyReady} personId={personId} />}
            </SidebarContent>
            <SidebarFooter>
                <SidebarGroup className="p-0">
                    <SidebarGroupLabel>Help</SidebarGroupLabel>
                    <SidebarMenu>
                        {HELP_NAV.map(link => (
                            <SidebarMenuItem key={link.href}>
                                <a className={linkClass} href={link.href} rel="noreferrer" target="_blank">
                                    <ItemContent icon={link.icon} label={link.label}>
                                        {link.href === STATUS_PAGE_URL && <ApiStatusDot enabled={keyReady} />}
                                    </ItemContent>
                                </a>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <Link className={linkClass} to={ACCOUNT_NAV.to}>
                            <ItemContent icon={ACCOUNT_NAV.icon} label={ACCOUNT_NAV.label}>
                                {me && <Badge className="ml-auto" variant="secondary">{PLAN_LABELS[me.plan]}</Badge>}
                            </ItemContent>
                        </Link>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
