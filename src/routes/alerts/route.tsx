import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import type { V2Me } from "@/lib/api/types";

import { Notice } from "@/components/ui/notice";
import { ALERTS_FAMILY } from "@/lib/alerts/labels";
import { ALERTS_TABS } from "@/lib/alerts/tabs";
import { useKeyState } from "@/lib/api/queries";

export const Route = createFileRoute("/alerts")({
    component: AlertsLayout,
});

/** Whether the key's plan reaches the alert operations (`/v1/me` `allowed_families` holds the docs group "Alerts"). */
export function plansAlerts(me: null | Pick<V2Me, "allowed_families">) {
    return me === null || me.allowed_families.includes(ALERTS_FAMILY);
}

/** The area's sub-navigation (Alerts · Events; A3 / A4 append theirs in `ALERTS_TABS`). */
export function AlertsTabs() {
    return (
        <nav aria-label="Alerts sections" className="flex flex-wrap gap-1 border-b">
            {ALERTS_TABS.map(tab => (
                <Link
                    activeOptions={{ exact: tab.exact ?? false, includeSearch: false }}
                    activeProps={{ "aria-current": "page", "className": "border-primary text-foreground" }}
                    className="-mb-px border-b-2 border-transparent px-3 py-2 font-medium text-muted-foreground hover:text-foreground"
                    key={tab.to}
                    to={tab.to}
                >
                    {tab.label}
                </Link>
            ))}
        </nav>
    );
}

/**
 * The alerts area (backend tasks/data-api-dashboard 2-alerts): its tabs and the plan gate. The key gate of the root
 * already waited for `/v1/me`; a plan without the alert operations sees one notice instead of failing pages.
 */
function AlertsLayout() {
    const { me } = useKeyState();

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-8">
            <AlertsTabs />
            {plansAlerts(me)
                ? <Outlet />
                : (
                        <Notice badge="Plan" title="Your plan does not include alerts">
                            The alert operations are not among the API families of your key. Plans and keys are managed in the Invinite Data app.
                        </Notice>
                    )}
        </div>
    );
}
