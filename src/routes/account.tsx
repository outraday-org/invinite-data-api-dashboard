import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";

import type { UsageWindow } from "@/lib/account";
import type { V2Me, V2Usage } from "@/lib/api/types";

import { AXIS_TICK, CHART_MARGIN, ChartFrame, GRID_STROKE, TOOLTIP_CONTENT_STYLE } from "@/components/charts/chart-parts";
import { AccountStatusCards } from "@/components/reference/api-status";
import { Badge } from "@/components/ui/badge";
import { DataTable, right } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat, StatGrid } from "@/components/ui/stat";
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

/** Plan, account name and rate limits: the header's meta line (`/v1/me`). */
export function AccountPlanLine({ me }: { me: V2Me }) {
    return (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge data-testid="account-plan">{PLAN_LABELS[me.plan]}</Badge>
            {me.account.name ? <span>{me.account.name}</span> : null}
            <span className="tabular-nums">{`${formatNumber(me.limits.requests_per_second)} req/s · ${formatNumber(me.limits.requests_per_minute)} req/min`}</span>
        </span>
    );
}

/** The share of the period's credits used, as a thin bar under its value (the numbers are in the text). */
function UsedBar({ included, used }: { included: number; used: number }) {
    const share = included > 0 ? Math.min(1, Math.max(0, used / included)) : 0;

    return (
        <span aria-hidden className="bg-muted mt-1 block h-1 w-full max-w-40 overflow-hidden rounded-full">
            <span className="bg-brand block h-full rounded-full" style={{ width: `${share * 100}%` }} />
        </span>
    );
}

/** The credits of the period (`/v1/me`). */
export function AccountSummary({ me }: { me: V2Me }) {
    const { credits } = me;

    return (
        <Section title="Credits">
            <StatGrid>
                <Stat label="Remaining" value={formatNumber(credits.remaining)} />
                <Stat
                    label="Used this period"
                    sub={<UsedBar included={credits.included} used={credits.used} />}
                    value={`${formatNumber(credits.used)} of ${formatNumber(credits.included)}`}
                />
                <Stat label="Resets" value={credits.resets_at ? formatInstant(credits.resets_at) : "No reset"} />
                <Stat label="Prepaid balance" value={credits.prepaid_balance_usd === null ? "—" : formatMoney(credits.prepaid_balance_usd)} />
            </StatGrid>
        </Section>
    );
}

/** The families the plan may call (`/v1/me`): a compact multi-column list. */
export function AccountFamilies({ me }: { me: V2Me }) {
    return (
        <Section title="Data families">
            {me.allowed_families.length > 0
                ? (
                        <ul className="columns-2 gap-6 sm:columns-3 lg:columns-5" data-testid="account-families">
                            {me.allowed_families.map(family => <li className="py-0.5" key={family}>{family}</li>)}
                        </ul>
                    )
                : <span className="text-muted-foreground">None</span>}
        </Section>
    );
}

/** The usage of the window (`/v1/me/usage`): credits per UTC day, then per family and per caller. */
export function UsageView({ usage }: { usage: V2Usage }) {
    const totalCredits = usage.daily.reduce((sum, day) => sum + day.credits, 0);

    const totalRequests = usage.daily.reduce((sum, day) => sum + day.requests, 0);

    const totalErrors = usage.daily.reduce((sum, day) => sum + usageErrorCount(day), 0);

    const label = `Credits per UTC day, last ${usage.window_days} days: ${formatNumber(totalCredits)} credits, ${formatNumber(totalRequests)} requests, ${formatNumber(totalErrors)} error responses`;

    return (
        <Section title="Usage">
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
                            cursor={{ fill: "var(--muted)" }}
                            formatter={(value, _name, _item, index) => [`${formatNumber(Number(value))} · ${formatNumber(usage.daily[index]?.requests)} requests`, "Credits"]}
                            labelFormatter={value => formatDay(String(value))}
                        />
                        {/* A day without credits keeps a 2 px stub in the border colour: the baseline stays visible. */}
                        <Bar dataKey="credits" minPointSize={2} radius={[2, 2, 0, 0]}>
                            {usage.daily.map(day => <Cell fill={day.credits > 0 ? "var(--brand)" : "var(--border)"} key={day.date} />)}
                        </Bar>
                    </BarChart>
                </ChartFrame>
            </div>
            {usage.truncated && <Notice badge="Capped" title="A breakdown below was capped at its item limit." />}
            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2">
                    <h3 className="text-sm font-semibold">By endpoint family</h3>
                    <DataTable columns={FAMILY_COLUMNS} emptyText="No requests in this window." isLoading={false} rows={usage.by_family} />
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                    <h3 className="text-sm font-semibold">By caller</h3>
                    <DataTable columns={CALLER_COLUMNS} emptyText="No requests in this window." isLoading={false} rows={usage.by_key} />
                </div>
            </div>
        </Section>
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
        <PageContainer>
            <PageHeader
                actions={(
                    <SegmentedButtons
                        aria-label="Usage window"
                        onChange={value => void navigate({ ...IN_PLACE, search: { days: toUsageWindow(value) } })}
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
                    </>
                )}
                meta={me.data ? <AccountPlanLine me={me.data} /> : null}
                title="Account"
            />
            {me.data ? <AccountSummary me={me.data} /> : me.error ? <ErrorState error={me.error} title="Failed to load the account" /> : <Skeleton className="h-32 w-full" />}
            {usage.data ? <UsageView usage={usage.data} /> : usage.error ? <ErrorState error={usage.error} title="Failed to load the usage" /> : <Skeleton className="h-64 w-full" />}
            {me.data && <AccountFamilies me={me.data} />}
            <AccountStatusCards plan={me.data?.plan ?? null} />
            {me.data && plansAlerts(me.data) && (
                <Section title="End-user defaults">
                    <p className="text-muted-foreground">
                        {"The limits your alert end users get by default: "}
                        <Link className="text-primary underline-offset-4 hover:underline" hash="defaults" to="/alerts/users">End-user defaults</Link>
                    </p>
                </Section>
            )}
        </PageContainer>
    );
}
