import { QueryClientContext } from "@tanstack/react-query";
import * as React from "react";

import type { OperationId, OperationTier } from "@/lib/api/operations.gen";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OPERATIONS } from "@/lib/api/operations.gen";
import { useMe } from "@/lib/api/queries";
import { planAllows } from "@/lib/api/request-meta";
import { formatNumber } from "@/lib/format";

/** The plan names a badge shows (the operation's `x-tier`; every member of the generated `PLAN_ORDER`). */
export const TIER_BADGE_LABELS: Record<OperationTier, string> = {
    enterprise: "ENTERPRISE",
    free: "FREE",
    lite: "LITE",
    pro: "PRO",
    standard: "STANDARD",
};

/** The badge label of the plan an operation needs (its `x-tier`): "PRO", "LITE", …; null for an operation without one. */
export function tierLabel(operationId: OperationId): null | string {
    const tier = OPERATIONS[operationId].tier;

    return tier ? TIER_BADGE_LABELS[tier] : null;
}

/**
 * The cost line of an operation from its `x-credits` (the spec's rule: + 1 credit per started 1,000 rows beyond the
 * first 1,000); null for an operation without a cost. `unit` names what one request is ("page", "request").
 */
export function creditText(operationId: OperationId, unit: "page" | "request" = "page"): null | string {
    const credits = OPERATIONS[operationId].credits;

    if (credits === null) return null;

    if (credits === 0) return `Free: 0 credits per ${unit}`;

    return `${formatNumber(credits)} ${credits === 1 ? "credit" : "credits"} per ${unit} (+1 per 1,000 rows beyond the first 1,000)`;
}

/** A billed control with its cost in a tooltip (`render` = the control, e.g. a `Button`). */
export function CreditHint({ children, operationId, render, unit }: {
    children: React.ReactNode;
    operationId: OperationId;
    render: React.ReactElement;
    unit?: "page" | "request";
}) {
    const text = creditText(operationId, unit);

    if (!text) return React.cloneElement(render, undefined, children);

    return (
        <Tooltip>
            <TooltipTrigger render={render}>{children}</TooltipTrigger>
            <TooltipContent>{text}</TooltipContent>
        </Tooltip>
    );
}

/**
 * Whether the key's plan includes an operation (`useMe()`'s plan vs its `x-tier`); null while the plan is unknown.
 * A page that defaults to a higher-tier view uses it to start below the plan instead of asking for a refusal.
 */
export function usePlanAllows(operationId: OperationId): boolean | null {
    const { data: me } = useMe();

    return me ? planAllows(me.plan, OPERATIONS[operationId].tier) : null;
}

function PlanBadgeForPlan({ tier }: { tier: OperationTier }) {
    const { data: me } = useMe();

    // Unknown plan (no answer yet): no badge rather than a wrong one.
    if (!me || planAllows(me.plan, tier)) return null;

    return (
        <Badge className="ml-1" title={`Needs the ${TIER_BADGE_LABELS[tier]} plan`} variant="outline">
            {TIER_BADGE_LABELS[tier]}
        </Badge>
    );
}

/**
 * The plan badge (LITE / STANDARD / PRO / ENTERPRISE) of a control whose operation the key's plan does not include, shown BEFORE any request
 * (`useMe()`'s plan against the operation's `x-tier`, in the spec's plan order). Nothing when the plan includes it,
 * while the plan is unknown, or outside a query client (pure view tests).
 */
export function PlanBadge({ operationId }: { operationId: OperationId }) {
    const client = React.useContext(QueryClientContext);

    const tier = OPERATIONS[operationId].tier;

    if (!client || !tier || tier === "free") return null;

    return <PlanBadgeForPlan tier={tier} />;
}
