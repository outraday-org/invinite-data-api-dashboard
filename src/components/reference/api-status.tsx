import type { ColumnDef } from "@tanstack/react-table";

import type { V2ApiStatus, V2Licensing, V2LicensingRight, V2Plan, V2ServiceStatus } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_LABELS } from "@/lib/account";
import { useApiLicensing, useApiStatus } from "@/lib/api/queries";
import { DASH, formatInstant, formatNumber } from "@/lib/format";
import { LICENSING_PAGE_URL, STATUS_PAGE_URL } from "@/lib/public-hosts";
import { cn } from "@/lib/utils";

/**
 * The status widget (O7 group 7): `GET /status` and `GET /status/licensing` as data — on `/account` a status card
 * (overall + every product family and docs group with uptime / latency) and a licensing card (the caller's plan's
 * rights, routes per family), in the sidebar a dot beside "API status". Both operations need no key and cost nothing.
 */

type Service = NonNullable<V2ApiStatus["services"]>[number];

type Group = NonNullable<V2ApiStatus["groups"]>[number];

type Family = V2Licensing["families"][number];

/** The overall state: the worst family status; `unknown` while the API states none (`services: null`). */
export type OverallStatus = "unknown" | V2ServiceStatus;

const STATUS_RANK: Record<V2ServiceStatus, number> = { degraded: 1, operational: 0, outage: 2 };

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

/** The worst status of the families (pure). */
export function overallStatus(services: null | ReadonlyArray<Pick<Service, "status">> | undefined): OverallStatus {
    if (!services || services.length === 0) return "unknown";

    return services.reduce<V2ServiceStatus>((worst, service) => (STATUS_RANK[service.status] > STATUS_RANK[worst] ? service.status : worst), "operational");
}

/** "Degraded: SEC filings, Institutional ownership · Outage: News" — or "All products operational" (pure). */
export function statusSummary(services: null | ReadonlyArray<Pick<Service, "family" | "status">> | undefined) {
    if (!services) return STATUS_LABELS.unknown;

    const parts = (["outage", "degraded"] as const)
        .map((status) => {
            const families = services.filter(service => service.status === status).map(service => FAMILY_LABELS[service.family]);

            return families.length > 0 ? `${STATUS_LABELS[status]}: ${families.join(", ")}` : null;
        })
        .filter(Boolean);

    return parts.length > 0 ? parts.join(" · ") : "All products operational";
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

/** The sidebar's dot beside "API status" (pure): its colour = the overall status; the families in its title and label. */
export function StatusDot({ status, summary }: { status: OverallStatus; summary: string }) {
    return (
        <span aria-label={summary} className="ml-auto flex items-center" data-testid="api-status-dot" role="img" title={summary}>
            <span className={cn("size-2 rounded-full", DOT_CLASSES[status])} />
        </span>
    );
}

/** The sidebar's live status dot (`/status`, shared with `/account`; nothing until the key answered). */
export function ApiStatusDot({ enabled }: { enabled: boolean }) {
    const { data, error } = useApiStatus(enabled);

    if (!data && !error) return null;

    return <StatusDot status={overallStatus(data?.services)} summary={data ? statusSummary(data.services) : STATUS_LABELS.unknown} />;
}

const SERVICE_COLUMNS: Array<ColumnDef<Service>> = [
    { cell: ({ row }) => FAMILY_LABELS[row.original.family], header: "Product", id: "family" },
    { cell: ({ row }) => <StatusBadge status={row.original.status} />, header: "Last 24 hours", id: "status" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{uptimeText(row.original.uptime_7d)}</div>, header: () => <div className="text-right">7 days</div>, id: "uptime_7d" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{uptimeText(row.original.uptime_30d)}</div>, header: () => <div className="text-right">30 days</div>, id: "uptime_30d" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{uptimeText(row.original.uptime_90d)}</div>, header: () => <div className="text-right">90 days</div>, id: "uptime_90d" },
];

const GROUP_COLUMNS: Array<ColumnDef<Group>> = [
    { cell: ({ row }) => row.original.name, header: "API group", id: "name" },
    { cell: ({ row }) => <StatusBadge status={row.original.status} />, header: "Last 24 hours", id: "status" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{uptimeText(row.original.uptime_7d)}</div>, header: () => <div className="text-right">Uptime 7 days</div>, id: "uptime_7d" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{latencyText(row.original.p50_ms_7d)}</div>, header: () => <div className="text-right">p50 (7 days)</div>, id: "p50_ms_7d" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{latencyText(row.original.p95_ms_7d)}</div>, header: () => <div className="text-right">p95 (7 days)</div>, id: "p95_ms_7d" },
];

const externalLink = (href: string, text: string) => (
    <a className="text-primary underline-offset-4 hover:underline" href={href} rel="noreferrer" target="_blank">{text}</a>
);

/** The status card of `/account` (pure): overall, the universe, every family and docs group. */
export function ApiStatusView({ status }: { status: V2ApiStatus }) {
    const overall = overallStatus(status.services);

    const { companies, earnings_calls: calls } = status.universe;

    return (
        <Card size="sm">
            <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>API status</CardTitle>
                    <StatusBadge status={overall} />
                </div>
                <CardDescription>
                    {statusSummary(status.services)}
                    {" · as of "}
                    {formatInstant(status.generated_at)}
                    {". Uptime = the share of requests answered without a server error; a status covers the last 24 hours. "}
                    {externalLink(STATUS_PAGE_URL, "Status page")}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
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
            </CardContent>
        </Card>
    );
}

/** The plans in order of what they may do (a route's tier is reached by that plan and every later one). */
const TIER_ORDER = ["free", "lite", "standard", "pro", "enterprise"] as const;

const RIGHT_LABELS: Record<V2LicensingRight, string> = {
    audio: "Audio",
    display: "Display",
    rag: "AI retrieval (RAG)",
    redistribute: "Redistribute",
    resell: "Resell",
    train: "Model training",
};

/** Per family: its routes and how many of them a plan reaches (a route's `tier` at or below the plan; pure). */
export function familyReach(families: ReadonlyArray<Family>, plan: V2Plan) {
    const rank = TIER_ORDER.indexOf(plan);

    return families.map(family => ({
        family: family.family,
        reachable: family.routes.filter(route => TIER_ORDER.indexOf(route.tier) <= rank).length,
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

/** The licensing card of `/account` (pure): what the caller's plan may do with the data, and its routes per family. */
export function LicensingView({ licensing, plan }: { licensing: V2Licensing; plan: V2Plan }) {
    const rights = licensing.tiers[plan];

    const notes: Partial<Record<string, string>> = licensing.notes;

    return (
        <Card size="sm">
            <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>Licensing</CardTitle>
                    <Badge variant="secondary">{`${PLAN_LABELS[plan]} plan`}</Badge>
                    <Badge variant="outline">{`Policy ${licensing.policy_version}`}</Badge>
                    {!licensing.counsel_signed_off && <Badge variant="outline">Draft</Badge>}
                </div>
                <CardDescription>
                    {"What your plan may do with the data. "}
                    {externalLink(LICENSING_PAGE_URL, "Full licensing matrix")}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <ul className="grid gap-2 sm:grid-cols-2" data-testid="licensing-rights">
                    {licensing.rights.map(right => (
                        <li className="flex flex-col gap-0.5" key={right}>
                            <span className="flex items-center gap-2">
                                <Badge variant={rights[right] ? "secondary" : "outline"}>{rights[right] ? "Allowed" : "Not on your plan"}</Badge>
                                <span className="font-medium">{RIGHT_LABELS[right]}</span>
                            </span>
                            {notes[right] && <span className="text-muted-foreground text-xs">{notes[right]}</span>}
                        </li>
                    ))}
                </ul>
                <p className="text-muted-foreground text-xs">{licensing.resale}</p>
                <DataTable columns={REACH_COLUMNS} emptyText="The policy lists no routes." exportConfig={{ dataset: "licensing-routes", scope: plan }} isLoading={false} rows={familyReach(licensing.families, plan)} />
            </CardContent>
        </Card>
    );
}

/** The two cards of `/account` (status always; licensing once the plan is known). */
export function AccountStatusCards({ plan }: { plan: null | V2Plan }) {
    const status = useApiStatus();

    const licensing = useApiLicensing();

    return (
        <div className="grid gap-4 lg:grid-cols-2">
            {status.data ? <ApiStatusView status={status.data} /> : status.error ? <ErrorState error={status.error} title="Failed to load the API status" /> : <Skeleton className="h-48 w-full" />}
            {licensing.data && plan
                ? <LicensingView licensing={licensing.data} plan={plan} />
                : licensing.error ? <ErrorState error={licensing.error} title="Failed to load the licensing policy" /> : <Skeleton className="h-48 w-full" />}
        </div>
    );
}
