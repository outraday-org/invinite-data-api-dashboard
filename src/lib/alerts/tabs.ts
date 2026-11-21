/**
 * The alerts area's sub-navigation (`src/routes/alerts/route.tsx`): A2's two tabs; A3 appends Destinations and
 * Webhooks, A4 Users and Scripts (the area ships complete as release R6, so no tab points at a missing page).
 */
export type AlertsTab = { exact?: boolean; label: string; to: "/alerts" | "/alerts/events" };

export const ALERTS_TABS: ReadonlyArray<AlertsTab> = [
    { exact: true, label: "Alerts", to: "/alerts" },
    { label: "Events", to: "/alerts/events" },
];
