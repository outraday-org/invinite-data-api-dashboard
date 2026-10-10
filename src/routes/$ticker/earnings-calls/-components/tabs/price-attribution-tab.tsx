import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

import type { EarningsPriceAttributionResponse, EarningsPriceUtteranceRef } from "@/lib/api/types";

import {
    AXIS_TICK,
    CHART_MARGIN,
    ChartFrame,
    GRID_STROKE,
    LINE_CURSOR,
    TOOLTIP_CONTENT_STYLE,
} from "@/components/status/chart-parts";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEarningsPriceAttribution } from "@/lib/api/queries";
import { formatDecimal, formatSigned } from "@/lib/earnings/labels";

import type { CallTabProps } from "../call-tabs";

import { MediaState, Notice } from "../media-state";
import { SeekButton } from "../seek-button";

/** The tab's lead text (the API's caveat): coincidence in time, never cause. */
export const PRICE_ATTRIBUTION_CAVEAT
    = "Minute-level price moves aligned to what was being said at the time. This is temporal coincidence, not attribution of cause; pre-market and after-hours bars are sparse.";

export const PRICE_ATTRIBUTION_UNAVAILABLE = "Price moves are not available for this call yet";

type AnchorKind = NonNullable<EarningsPriceAttributionResponse["anchor_kind"]>;
type LagKind = NonNullable<EarningsPriceAttributionResponse["lag_kind"]>;
type MarketSession = NonNullable<EarningsPriceAttributionResponse["session"]>;

const ANCHOR_KIND_LABELS: Record<AnchorKind, string> = {
    started_at: "First spoken word",
    t0_wallclock: "Capture clock",
};

const LAG_KIND_LABELS: Record<LagKind, string> = {
    dialin_offset: "dial-in offset",
    none: "no correction",
    playlist: "stream playlist",
};

const MARKET_SESSION_LABELS: Record<MarketSession, string> = {
    post: "After hours",
    pre: "Pre-market",
    regular: "Regular session",
};

const minuteFormat = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
});

/** A bucket's minute in New York time ("4:31 PM"). */
function formatMinute(iso: string) {
    return minuteFormat.format(new Date(iso));
}

/** A signed return in basis points ("+12.5 bps"); null → "—". */
function formatBps(value: null | number) {
    const signed = formatSigned(value, 1);

    return signed === null ? "—" : `${signed} bps`;
}

function formatLag(data: EarningsPriceAttributionResponse) {
    if (data.anchor_lag_ms === null) return "—";

    const seconds = `${formatDecimal(data.anchor_lag_ms / 1000, 1)} s`;

    return data.lag_kind ? `${seconds} (${LAG_KIND_LABELS[data.lag_kind]})` : seconds;
}

function AnchorFacts({ data }: { data: EarningsPriceAttributionResponse }) {
    const facts: Array<{ label: string; value: string }> = [
        { label: "Anchor", value: data.anchor_kind ? ANCHOR_KIND_LABELS[data.anchor_kind] : "—" },
        { label: "Lag", value: formatLag(data) },
        {
            label: "Uncertainty",
            value: data.anchor_uncertainty_s === null ? "—" : `± ${formatDecimal(data.anchor_uncertainty_s, 1)} s`,
        },
        { label: "Session", value: data.session ? MARKET_SESSION_LABELS[data.session] : "—" },
        { label: "Minute bars", value: data.bar_count.toLocaleString("en-US") },
        { label: "End of window", value: formatBps(data.end_of_window_return_bps) },
    ];

    return (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
            {facts.map(fact => (
                <div className="flex flex-col" key={fact.label}>
                    <dt className="text-muted-foreground text-xs">{fact.label}</dt>
                    <dd className="tabular-nums">{fact.value}</dd>
                </div>
            ))}
        </dl>
    );
}

function UtteranceRefs({ refs }: { refs: Array<EarningsPriceUtteranceRef> }) {
    if (refs.length === 0) return <span className="text-muted-foreground">—</span>;

    return (
        <ul className="flex flex-col gap-1">
            {refs.map((ref, index) => (
                <li className="flex flex-wrap items-baseline gap-x-2" key={`${index}:${ref.start_ms}:${ref.speaker_label}`}>
                    <SeekButton startMs={ref.start_ms} />
                    <span className="text-muted-foreground">{`Speaker ${ref.speaker_label}`}</span>
                    <span>{ref.text}</span>
                </li>
            ))}
        </ul>
    );
}

function TopMinutes({ data }: { data: EarningsPriceAttributionResponse }) {
    if (data.top_minutes.length === 0) return null;

    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Largest minute moves</h3>
            <ol className="flex flex-col gap-3">
                {data.top_minutes.map(minute => (
                    <li className="border-border/70 rounded-lg border p-3" key={minute.bucket}>
                        <div className="mb-1 flex items-baseline gap-3">
                            <span className="font-medium tabular-nums">{formatMinute(minute.bucket)}</span>
                            <span className="tabular-nums">{formatBps(minute.return_bps)}</span>
                        </div>
                        <UtteranceRefs refs={minute.utterance_refs} />
                    </li>
                ))}
            </ol>
        </section>
    );
}

function CumulativeChart({ data }: { data: EarningsPriceAttributionResponse }) {
    const rows = data.buckets.map(bucket => ({
        cumulative: bucket.cumulative_return_bps,
        minute: formatMinute(bucket.bucket),
    }));

    return (
        <ChartFrame description="Cumulative return since the call started, New York time" title="Cumulative return (bps)">
            <LineChart data={rows} margin={CHART_MARGIN}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis axisLine={{ stroke: GRID_STROKE }} dataKey="minute" minTickGap={24} tick={AXIS_TICK} tickLine={false} />
                <YAxis axisLine={false} tick={AXIS_TICK} tickFormatter={(value: number) => formatSigned(value, 0) ?? ""} tickLine={false} width={56} />
                <ReferenceLine stroke={GRID_STROKE} y={0} />
                <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    cursor={LINE_CURSOR}
                    formatter={value => (typeof value === "number" ? formatBps(value) : "—")}
                />
                <Line
                    dataKey="cumulative"
                    dot={false}
                    isAnimationActive={false}
                    name="Cumulative return"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    type="monotone"
                />
            </LineChart>
        </ChartFrame>
    );
}

function BucketTable({ data }: { data: EarningsPriceAttributionResponse }) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Minute (ET)</TableHead>
                    <TableHead>Return</TableHead>
                    <TableHead>Cumulative</TableHead>
                    <TableHead>Being said</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.buckets.map(bucket => (
                    <TableRow key={bucket.bucket}>
                        <TableCell className="tabular-nums">{formatMinute(bucket.bucket)}</TableCell>
                        <TableCell className="tabular-nums">{formatBps(bucket.return_bps)}</TableCell>
                        <TableCell className="tabular-nums">{formatBps(bucket.cumulative_return_bps)}</TableCell>
                        <TableCell className="whitespace-normal">
                            <UtteranceRefs refs={bucket.utterance_refs} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

export type PriceAttributionViewProps = {
    data: EarningsPriceAttributionResponse | null;
    error: unknown;
    isLoading: boolean;
};

/**
 * The tab's body: anchor facts, the largest minute moves with what was being said, the
 * cumulative-return line and every minute bucket. Derived returns only — the API sends no
 * price or volume, so none is shown.
 */
export function PriceAttributionView({ data, error, isLoading }: PriceAttributionViewProps) {
    return (
        <div className="flex flex-col gap-4">
            <p className="text-muted-foreground">{PRICE_ATTRIBUTION_CAVEAT}</p>

            {error
                ? <MediaState error={error} notFound={PRICE_ATTRIBUTION_UNAVAILABLE} title="Failed to load price moves" />
                : isLoading || !data
                    ? <Skeleton className="h-40 w-full" />
                    : (
                            <>
                                <AnchorFacts data={data} />
                                {data.buckets.length === 0
                                    ? <Notice title="No minute bars in the call window" />
                                    : (
                                            <>
                                                <TopMinutes data={data} />
                                                <CumulativeChart data={data} />
                                                <BucketTable data={data} />
                                            </>
                                        )}
                            </>
                        )}
        </div>
    );
}

/** "Price moves" tab: minute returns of the call window next to the utterances spoken in each minute. */
export function PriceAttributionTab({ selector }: CallTabProps) {
    const { data, error, isLoading } = useEarningsPriceAttribution(selector);

    return <PriceAttributionView data={data} error={error} isLoading={isLoading} />;
}
