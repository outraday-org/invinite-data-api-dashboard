import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import * as React from "react";

import { Notice } from "@/components/ui/notice";
import { PageContainer } from "@/components/ui/page-container";
import { HeadingLevelProvider } from "@/components/ui/page-header";
import { SCROLL_ROW_CLASS, ScrollEdgeFades, useActiveItemInView, useScrollEdges } from "@/components/ui/scroll-row";
import { plansAlerts } from "@/lib/alerts/labels";
import { ALERTS_TABS } from "@/lib/alerts/tabs";
import { useKeyState } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

// The plan gate lives in `labels.ts` (A4's entry points and `/account` use it too); kept importable from here.
export { plansAlerts };

export const Route = createFileRoute("/alerts")({
    component: AlertsLayout,
});

/** The tab a pathname belongs to (pure): the sub-tab whose path it is or starts with; else — `/alerts` itself, `/alerts/new`, `/alerts/<id>` — "Alerts". */
export function activeAlertsTab(pathname: string): string {
    const path = pathname.replace(/\/+$/, "");

    return ALERTS_TABS.find(tab => tab.to !== "/alerts" && (path === tab.to || path.startsWith(`${tab.to}/`)))?.to ?? "/alerts";
}

/**
 * The area's sections as one row of line-tab links (ui-redesign task 13, the twin of the ticker header's section tabs):
 * `aria-current="page"` on the active one (an alert's page and the form keep "Alerts"), a brand underline, and a row that
 * scrolls sideways inside itself on a phone with a fade on a cut edge.
 */
export function AlertsTabs() {
    const scroller = React.useRef<HTMLDivElement>(null);

    const pathname = useRouterState({ select: state => state.location.pathname });

    const active = activeAlertsTab(pathname);

    const edges = useScrollEdges(scroller);

    useActiveItemInView(scroller, active);

    return (
        <nav aria-label="Alerts sections" className="relative min-w-0 border-b">
            <div className={cn(SCROLL_ROW_CLASS, "gap-1")} ref={scroller}>
                {ALERTS_TABS.map((tab) => {
                    const isActive = tab.to === active;

                    return (
                        <Link
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                                "text-muted-foreground hover:text-foreground relative flex h-9 shrink-0 items-center rounded-sm px-2.5 whitespace-nowrap transition-colors max-sm:h-10",
                                "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full",
                                isActive && "text-foreground font-medium after:bg-brand",
                            )}
                            data-active={isActive || undefined}
                            key={tab.to}
                            to={tab.to}
                        >
                            {tab.label}
                        </Link>
                    );
                })}
            </div>
            <ScrollEdgeFades edges={edges} />
        </nav>
    );
}

/**
 * The alerts area (backend tasks/data-api-dashboard 2-alerts): its family header — the `h1` "Alerts" and the section
 * tabs — and the plan gate. The key gate of the root already waited for `/v1/me`; a plan without the alert operations
 * sees one notice instead of failing pages. A sub-page's `PageHeader` is an `h2` below the family `h1`.
 */
function AlertsLayout() {
    const { me } = useKeyState();

    return (
        <PageContainer>
            <header className="flex flex-col gap-2" data-testid="alerts-family-header">
                <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
                <AlertsTabs />
            </header>
            {plansAlerts(me)
                ? <HeadingLevelProvider value={2}><Outlet /></HeadingLevelProvider>
                : (
                        <Notice badge="Plan" title="Your plan does not include alerts">
                            The alert operations are not among the API families of your key. Plans and keys are managed in the Invinite Data app.
                        </Notice>
                    )}
        </PageContainer>
    );
}
