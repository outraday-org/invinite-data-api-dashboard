import type { ColumnDef } from "@tanstack/react-table";

import type { V2ApiStatus, V2Licensing, V2LicensingRight, V2Plan } from "@/lib/api/types";
import type { OverallStatus } from "@/lib/reference/public-status";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_LABELS } from "@/lib/account";
import { PLAN_ORDER } from "@/lib/api/operations.gen";
import { useApiLicensing, useApiStatus } from "@/lib/api/queries";
import { planRank } from "@/lib/api/request-meta";
import { DASH, formatInstant, formatNumber } from "@/lib/format";
import { LICENSING_PAGE_URL, STATUS_PAGE_URL } from "@/lib/public-hosts";
import { useOverallStatus } from "@/lib/reference/public-status";
import { cn } from "@/lib/utils";

/**
 * The status widget (O7 group 7): `GET /status` and `GET /status/licensing` as data — on `/account` a status card
 * (overall + every product family and docs group with uptime / latency) and a licensing card (the caller's plan's
 * rights, routes per family) as two sections, in the sidebar a dot beside "API status". Both operations need no key and cost nothing.
 */

type Service = NonNullable<V2ApiStatus["services"]>[number];

type Group = NonNullable<V2ApiStatus["groups"]>[number];

type Family = V2Licensing["families"][number];

export const STATUS_LABELS: Record<OverallStatus, string> = {
    degraded: "Degraded",
    operational: "Operational",
    outage: "Outage",
    unknown: "Status unavailable",
};

const DOT_CLASSES: Record<OverallStatus, string> = {
    degraded: "bg-amber-500",
    operational: "bg-emerald-500",
    outage: "bg-destructive",
    unknown: "bg-muted-foreground/40",
};

/** The product families in words (both `/status` and `/status/licensing`). */
export const FAMILY_LABELS: Record<Family["family"] | Service["family"], string> = {
    account: "Account",
    alerts: "Alerts",
    company: "Company",
    earnings_calls: "Earnings calls",
    financials: "Financials",
    insider_trades: "Insider trades",
    institutional_ownership: "Institutional ownership",
    ipos: "IPOs",
    market: "Market",
    metadata: "Metadata",
    news: "News",
    sec_filings: "SEC filings",
    websocket: "WebSocket",
};

/** "Degraded: SEC filings, Institutional ownership · Outage: News" — or "All products operational" (pure). */
function statusSummary(services: null | ReadonlyArray<Pick<Service, "family" | "status">> | undefined) {
    if (!services?.length) return "Product family status unavailable";

    const parts = (["outage", "degraded"] as const)
        .map((status) => {
            const families = services.filter(service => service.status === status).map(service => FAMILY_LABELS[service.family]);

            return families.length > 0 ? `${STATUS_LABELS[status]}: ${families.join(", ")}` : null;
        })
        .filter(Boolean);

    return parts.length > 0 ? `Product families · ${parts.join(" · ")}` : "All product families operational";
}

/** A share of answered requests (0.989 → "98.9%"); null = too little traffic to judge ("—"). */
export function uptimeText(value: null | number | undefined) {
    if (value === null || value === undefined || !Number.isFinite(value)) return DASH;

    return `${formatNumber(value * 100, { maximumFractionDigits: 2 })}%`;
}

/** A latency bucket's upper bound ("≤ 800 ms"); null = too little traffic or above 12.8 s. */
export function latencyText(value: null | number | undefined) {
    return value === null || value === undefined ? DASH : `≤ ${formatNumber(value)} ms`;
}

export function StatusBadge({ status }: { status: OverallStatus }) {
    return (
        <Badge className="gap-1.5" variant={status === "outage" ? "destructive" : "outline"}>
            <span aria-hidden className={cn("size-1.5 rounded-full", DOT_CLASSES[status])} />
            {STATUS_LABELS[status]}
        </Badge>
    );
}

const OVERALL_LABELS: Record<OverallStatus, string> = {
    degraded: "Partial service disruption",
    operational: "All services operational",
    outage: "API outage",
    unknown: "Status unavailable",
};

/** The sidebar's status is available by colour, screen reader and tooltip. */
export function StatusDot({ status }: { status: OverallStatus }) {
    const summary = OVERALL_LABELS[status];

    return (
        <span aria-label={summary} className="ml-auto flex items-center" data-testid="api-status-dot" role="img" title={summary}>
            <span className={cn("size-2 rounded-full", DOT_CLASSES[status])} />
        </span>
    );
}

/** The public snapshot also drives the overall badge on the account page. */
export function ApiStatusDot() {
    const overall = useOverallStatus();

    return <StatusDot status={overall} />;
}

const SERVICE_COLUMNS: Array<ColumnDef<Service>> = [
    { cell: ({ row }) => FAMILY_LABELS[row.original.family], header: "Product", id: "family" },
    { cell: ({ row }) => <StatusBadge status={row.original.status} />, header: "Status", id: "status" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{uptimeText(row.original.uptime_7d)}</div>, header: () => <div className="text-right">7 days</div>, id: "uptime_7d" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{uptimeText(row.original.uptime_30d)}</div>, header: () => <div className="text-right">30 days</div>, id: "uptime_30d" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{uptimeText(row.original.uptime_90d)}</div>, header: () => <div className="text-right">90 days</div>, id: "uptime_90d" },
];

const GROUP_COLUMNS: Array<ColumnDef<Group>> = [
    { cell: ({ row }) => row.original.name, header: "API group", id: "name" },
    { cell: ({ row }) => <StatusBadge status={row.original.status} />, header: "Status", id: "status" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{uptimeText(row.original.uptime_7d)}</div>, header: () => <div className="text-right">Uptime 7 days</div>, id: "uptime_7d" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{latencyText(row.original.p50_ms_7d)}</div>, header: () => <div className="text-right">p50 (7 days)</div>, id: "p50_ms_7d" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{latencyText(row.original.p95_ms_7d)}</div>, header: () => <div className="text-right">p95 (7 days)</div>, id: "p95_ms_7d" },
];

const externalLink = (href: string, text: string) => (
    <a className="text-primary underline-offset-4 hover:underline" href={href} rel="noreferrer" target="_blank">{text}</a>
);

/** The status section of `/account` (pure): overall, the universe, every family and docs group. */
export function ApiStatusView({ overall, status }: { overall: OverallStatus; status: V2ApiStatus }) {
    const { companies, earnings_calls: calls } = status.universe;

    return (
        <Section
            actions={<StatusBadge status={overall} />}
            description={(
                <>
                    {statusSummary(status.services)}
                    {" · as of "}
                    {formatInstant(status.generated_at)}
                    {". Product and group statuses use requests from today and yesterday (UTC). Uptime is the share answered without a server error. "}
                    {externalLink(STATUS_PAGE_URL, "Status page")}
                </>
            )}
            title="API status"
        >
            <p className="text-muted-foreground text-xs" data-testid="api-status-universe">
                {`Coverage: ${formatNumber(companies)} listed companies · earnings calls for ${formatNumber(calls.companies)} companies (scope ${calls.scope})`}
            </p>
            {status.services
                ? <DataTable columns={SERVICE_COLUMNS} emptyText="No product states its status." exportConfig={{ dataset: "api-status-products", scope: "all" }} isLoading={false} rows={status.services} />
                : <p className="text-muted-foreground text-sm">The API states no product status right now.</p>}
            {status.groups && status.groups.length > 0 && (
                <details>
                    <summary className="cursor-pointer text-sm font-medium">Per API group: uptime and latency</summary>
                    <div className="mt-2">
                        <DataTable columns={GROUP_COLUMNS} emptyText="No API group states its status." exportConfig={{ dataset: "api-status-groups", scope: "all" }} isLoading={false} rows={status.groups} />
                    </div>
                </details>
            )}
        </Section>
    );
}

const RIGHT_LABELS: Record<V2LicensingRight, string> = {
    audio: "Audio",
    display: "Display",
    rag: "AI retrieval (RAG)",
    redistribute: "Redistribute",
    redistribute_api: "Redistribute through your API",
    resell: "Resell",
    train: "Model training",
};

/** Per family: its routes and how many of them a plan reaches (a route's `tier` at or below the plan; pure). */
export function familyReach(families: ReadonlyArray<Family>, plan: V2Plan) {
    const rank = PLAN_ORDER.indexOf(planRank(plan));

    return families.map(family => ({
        family: family.family,
        reachable: family.routes.filter(route => PLAN_ORDER.indexOf(route.tier) <= rank).length,
        total: family.routes.length,
    }));
}

type ReachRow = ReturnType<typeof familyReach>[number];

const REACH_COLUMNS: Array<ColumnDef<ReachRow>> = [
    { cell: ({ row }) => FAMILY_LABELS[row.original.family], header: "Product", id: "family" },
    {
        cell: ({ row }) => <div className="text-right tabular-nums">{`${formatNumber(row.original.reachable)} of ${formatNumber(row.original.total)}`}</div>,
        header: () => <div className="text-right">Routes on your plan</div>,
        id: "reachable",
    },
];

/** The licensing section of `/account` (pure): what the caller's plan may do with the data, and its routes per family. */
export function LicensingView({ licensing, plan }: { licensing: V2Licensing; plan: V2Plan }) {
    // A pay-as-you-go account (credits without a plan) holds the FREE column's rights: evaluation only.
    const rights = licensing.tiers[plan === "payg" ? "free" : plan];

    const notes: Partial<Record<string, string>> = licensing.notes;

    // A right the API grants per contract (`by_contract`, e.g. training on ENTERPRISE): the plan allows it, a deal grants it.
    const rightBadge = (right: V2LicensingRight) => (!rights[right] ? "Not on your plan" : licensing.by_contract.includes(right) ? "By contract" : "Allowed");

    return (
        <Section
            actions={(
                <>
                    <Badge variant="secondary">{`${PLAN_LABELS[plan]} plan`}</Badge>
                    <Badge variant="outline">{`Policy ${licensing.policy_version}`}</Badge>
                    {!licensing.counsel_signed_off && <Badge variant="outline">Draft</Badge>}
                </>
            )}
            description={(
                <>
                    {"What your plan may do with the data. "}
                    {externalLink(LICENSING_PAGE_URL, "Full licensing matrix")}
                </>
            )}
            title="Licensing"
        >
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="licensing-rights">
                {licensing.rights.map(right => (
                    <li className="flex flex-col gap-0.5" key={right}>
                        <span className="flex items-center gap-2">
                            <Badge variant={rights[right] ? "secondary" : "outline"}>{rightBadge(right)}</Badge>
                            <span className="font-medium">{RIGHT_LABELS[right]}</span>
                        </span>
                        {notes[right] && <span className="text-muted-foreground text-xs">{notes[right]}</span>}
                    </li>
                ))}
            </ul>
            <p className="text-muted-foreground text-xs">{licensing.resale}</p>
            <p className="text-muted-foreground text-xs" data-testid="licensing-internal-use">{licensing.notes.internal_use}</p>
            <DataTable columns={REACH_COLUMNS} emptyText="The policy lists no routes." exportConfig={{ dataset: "licensing-routes", scope: plan }} isLoading={false} rows={familyReach(licensing.families, plan)} />
        </Section>
    );
}

/** The two sections of `/account` (status always; licensing once the plan is known), stacked. */
export function AccountStatusCards({ plan }: { plan: null | V2Plan }) {
    const overall = useOverallStatus();

    const status = useApiStatus();

    const licensing = useApiLicensing();

    return (
        <>
            {status.data ? <ApiStatusView overall={overall} status={status.data} /> : status.error ? <ErrorState error={status.error} title="Failed to load the API status" /> : <Skeleton className="h-48 w-full" />}
            {licensing.data && plan
                ? <LicensingView licensing={licensing.data} plan={plan} />
                : licensing.error ? <ErrorState error={licensing.error} title="Failed to load the licensing policy" /> : <Skeleton className="h-48 w-full" />}
        </>
    );
}
