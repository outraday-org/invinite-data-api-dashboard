import type { V2Me, V2Plan, V2Usage } from "@/lib/api/types";

import { formatNumber } from "@/lib/format";

/**
 * The plan names of `/v1/me` and `/v1/me/usage` (`payg` = a prepaid-credits account without a plan; both name it
 * `payg` since Data API 10.3.0 — `prepaid` is gone from the wire).
 */
export const PLAN_LABELS: Record<V2Plan | V2Usage["period"]["tier"], string> = {
    enterprise: "Enterprise",
    free: "Free",
    lite: "Lite",
    payg: "Pay as you go",
    pro: "PRO",
    standard: "Standard",
};

/** The line a saved key earns: "Key valid · PRO plan · 48,210 credits". */
export function keyValidText(me: Pick<V2Me, "credits" | "plan">) {
    return `Key valid · ${PLAN_LABELS[me.plan]} plan · ${formatNumber(me.credits.remaining)} credits`;
}

/** The usage windows `/v1/me/usage` answers (`days` 1–90; the answer names 7, 30 or 90). */
export const USAGE_WINDOWS = [7, 30, 90] as const;

export type UsageWindow = (typeof USAGE_WINDOWS)[number];

/** `?days=` of `/account`: one of the windows, else 30 (the API's default). */
export function toUsageWindow(value: unknown): UsageWindow {
    const days = Number(value);

    return (USAGE_WINDOWS as ReadonlyArray<number>).includes(days) ? days as UsageWindow : 30;
}

/** A day's error responses summed over the status classes. */
export function usageErrorCount(day: V2Usage["daily"][number]) {
    return Object.values(day.errors).reduce((sum, count) => sum + count, 0);
}
