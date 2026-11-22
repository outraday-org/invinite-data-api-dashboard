import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import type { UsageWindow } from "@/lib/account";
import type { V2Me, V2Usage } from "@/lib/api/types";

import { AXIS_TICK, CHART_MARGIN, ChartFrame, GRID_STROKE, TOOLTIP_CONTENT_STYLE } from "@/components/charts/chart-parts";
import { TabStrip } from "@/components/navigation/tab-strip";
import { AccountStatusCards } from "@/components/reference/api-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, right } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_LABELS, toUsageWindow, USAGE_WINDOWS, usageErrorCount } from "@/lib/account";
import { plansAlerts } from "@/lib/alerts/labels";
import { useMe, useMyUsage } from "@/lib/api/queries";
import { dataApiDashboardUrl } from "@/lib/app-url";
import { formatDay, formatInstant, formatMoney, formatNumber } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { IN_PLACE } from "@/lib/url-state";

export const Route = createFileRoute("/account")({
    component: AccountPage,
    head: () => titleHead("Account"),
    // `?days=7|30|90`; absent or anything else = 30 (the API's default), never sent back to the URL.
    validateSearch: (search: Record<string, unknown>): { days?: UsageWindow } => (search.days === undefined ? {} : { days: toUsageWindow(search.days) }),
});

type FamilyRow = V2Usage["by_family"][number];

type CallerRow = V2Usage["by_key"][number];

const FAMILY_COLUMNS: Array<ColumnDef<FamilyRow>> = [
    { cell: ({ row }) => row.original.label, header: "Family", id: "label" },
    { cell: ({ row }) => right(formatNumber(row.original.requests)), header: () => right("Requests"), id: "requests" },
    { cell: ({ row }) => right(formatNumber(row.original.credits)), header: () => right("Credits"), id: "credits" },
];

const CALLER_LABELS: Record<CallerRow["caller"], string> = { key: "API key", oauth: "Signed-in user", unknown: "Not recorded" };

const CALLER_COLUMNS: Array<ColumnDef<CallerRow>> = [
    { cell: ({ row }) => row.original.label, header: "Caller", id: "label" },
    { cell: ({ row }) => CALLER_LABELS[row.original.caller], header: "Kind", id: "caller" },
    { cell: ({ row }) => <span className="font-mono">{row.original.key_hint ?? "—"}</span>, header: "Key", id: "key_hint" },
    { cell: ({ row }) => right(formatNumber(row.original.requests)), header: () => right("Requests"), id: "requests" },
    { cell: ({ row }) => right(formatNumber(row.original.credits)), header: () => right("Credits"), id: "credits" },
];

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-sm font-medium tabular-nums">{value}</span>
        </div>
    );
}

/** Plan, rate limits, credits and the families the plan may call (`/v1/me`). */
export function AccountSummary({ me }: { me: V2Me }) {
    const { credits, limits } = me;

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card size="sm">
                <CardHeader><CardTitle>Plan</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <Badge data-testid="account-plan">{PLAN_LABELS[me.plan]}</Badge>
                        <span className="text-muted-foreground">{me.account.name ?? me.account.id}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Stat label="Requests / second" value={formatNumber(limits.requests_per_second)} />
                        <Stat label="Requests / minute" value={formatNumber(limits.requests_per_minute)} />
                    </div>
                </CardContent>
            </Card>
            <Card size="sm">
                <CardHeader><CardTitle>Credits</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                    <Stat label="Remaining" value={formatNumber(credits.remaining)} />
                    <Stat label="Used this period" value={`${formatNumber(credits.used)} of ${formatNumber(credits.included)}`} />
                    <Stat label="Resets" value={credits.resets_at ? formatInstant(credits.resets_at) : "No reset"} />
                    <Stat label="Prepaid balance" value={credits.prepaid_balance_usd === null ? "—" : formatMoney(credits.prepaid_balance_usd)} />
                </CardContent>
            </Card>
            <Card size="sm">
                <CardHeader><CardTitle>Allowed data families</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-1">
                    {me.allowed_families.length > 0
                        ? me.allowed_families.map(family => <Badge key={family} variant="outline">{family}</Badge>)
                        : <span className="text-muted-foreground">None</span>}
                </CardContent>
            </Card>
        </div>
    );
}

/** The usage of the window (`/v1/me/usage`): credits per UTC day, then per family and per caller. */
export function UsageView({ usage }: { usage: V2Usage }) {
    const totalCredits = usage.daily.reduce((sum, day) => sum + day.credits, 0);

    const totalRequests = usage.daily.reduce((sum, day) => sum + day.requests, 0);

    const totalErrors = usage.daily.reduce((sum, day) => sum + usageErrorCount(day), 0);

    const label = `Credits per UTC day, last ${usage.window_days} days: ${formatNumber(totalCredits)} credits, ${formatNumber(totalRequests)} requests, ${formatNumber(totalErrors)} error responses`;

    return (
        <div className="flex flex-col gap-6">
            <div aria-label={label} role="img">
                <ChartFrame
                    description={`${formatNumber(totalCredits)} credits · ${formatNumber(totalRequests)} requests · ${formatNumber(totalErrors)} error responses (credits are billed on 2xx answers only)`}
                    title={`Credits per day (UTC), last ${usage.window_days} days`}
                >
                    <BarChart data={usage.daily} margin={CHART_MARGIN}>
                        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                        <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(value: string) => formatDay(value).replace(/, \d{4}$/, "")} />
                        <YAxis tick={AXIS_TICK} tickFormatter={(value: number) => formatNumber(value, { notation: "compact" })} width={48} />
                        <Tooltip
                            contentStyle={TOOLTIP_CONTENT_STYLE}
                            formatter={value => [formatNumber(Number(value)), "Credits"]}
                            labelFormatter={value => formatDay(String(value))}
                        />
                        <Bar dataKey="credits" fill="var(--series-1)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                </ChartFrame>
            </div>
            {usage.truncated && <Notice badge="Capped" title="A breakdown below was capped at its item limit." />}
            <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">By endpoint family</h3>
                <DataTable columns={FAMILY_COLUMNS} emptyText="No requests in this window." isLoading={false} rows={usage.by_family} />
            </section>
            <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">By key</h3>
                <DataTable columns={CALLER_COLUMNS} emptyText="No requests in this window." isLoading={false} rows={usage.by_key} />
            </section>
        </div>
    );
}

/**
 * The account (`/v1/me` + `/v1/me/usage`, both 0 credits): plan, rate limits, credits, the families the plan may call and
 * the usage of a 7 / 30 / 90-day window. Keys, invoices and plan changes live in the Invinite Data app. Below: the API's
 * status and the plan's licensing rights (`/status`, `/status/licensing`; O7 group 7).
 */
function AccountPage() {
    const days = toUsageWindow(Route.useSearch().days);

    const navigate = Route.useNavigate();

    const me = useMe();

    const usage = useMyUsage(days);

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-8">
            <PageHeader
                actions={(
                    <TabStrip
                        aria-label="Usage window"
                        onSelect={value => void navigate({ ...IN_PLACE, search: { days: toUsageWindow(value) } })}
                        options={USAGE_WINDOWS.map(window => ({ label: `${window} days`, value: String(window) }))}
                        value={String(days)}
                    />
                )}
                description={(
                    <>
                        Your plan, credits and usage as the Data API counts them.
                        {" "}
                        <a className="text-primary underline-offset-4 hover:underline" href={dataApiDashboardUrl()} rel="noreferrer" target="_blank">
                            Keys, invoices and plan changes
                        </a>
                        {" "}
                        live in the Invinite Data app.
                        {me.data && plansAlerts(me.data) && (
                            <>
                                {" The limits your alert end users get by default are under "}
                                <Link className="text-primary underline-offset-4 hover:underline" hash="defaults" to="/alerts/users">End-user defaults</Link>
                                .
                            </>
                        )}
                    </>
                )}
                title="Account"
            />
            {me.data ? <AccountSummary me={me.data} /> : me.error ? <ErrorState error={me.error} title="Failed to load the account" /> : <Skeleton className="h-32 w-full" />}
            {usage.data ? <UsageView usage={usage.data} /> : usage.error ? <ErrorState error={usage.error} title="Failed to load the usage" /> : <Skeleton className="h-64 w-full" />}
            <AccountStatusCards plan={me.data?.plan ?? null} />
        </div>
    );
}
