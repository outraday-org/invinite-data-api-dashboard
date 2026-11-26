/**
 * The alerts area's sub-navigation (`src/routes/alerts/route.tsx`): A2's two tabs; A3 appends Destinations and
 * Webhooks, A4 Users and Scripts (the area ships complete as release R6, so no tab points at a missing page).
 */
export type AlertsTab = { label: string; to: "/alerts" | "/alerts/destinations" | "/alerts/events" | "/alerts/scripts" | "/alerts/users" | "/alerts/webhooks" };

export const ALERTS_TABS: ReadonlyArray<AlertsTab> = [
    { label: "Alerts", to: "/alerts" },
    { label: "Events", to: "/alerts/events" },
    { label: "Webhooks", to: "/alerts/destinations" },
    { label: "Users", to: "/alerts/users" },
    { label: "Scripts", to: "/alerts/scripts" },
    { label: "Webhook docs", to: "/alerts/webhooks" },
];
