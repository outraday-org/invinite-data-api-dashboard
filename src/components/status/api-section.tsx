import * as React from "react";

import type { ApiStatusResponse, ProductFamily, StatusFamily } from "@/lib/api/types";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { familyDayRows, hasNoMeasuredRequests, windowDayList } from "@/lib/status/chart-data";
import {
    familyLabel,
    familySeriesStyle,
    formatMs,
    formatRatioPercent,
    PRODUCT_FAMILIES,
    utcDayOf,
} from "@/lib/status/labels";
import { cn } from "@/lib/utils";

import { StatePanel } from "./chart-parts";
import { FamilyLineChart } from "./family-line-chart";

const WEBSOCKET_NOTE = "WebSocket: not measured here; live earnings-call delivery is covered by the pipeline section.";

const formatAvailabilityAxis = (value: number) => `${value.toFixed(2)}%`;

const formatMsAxis = (value: number) => `${Math.round(value).toLocaleString("en")} ms`;

const KNOWN_FAMILIES = new Set<string>(PRODUCT_FAMILIES);

/**
 * The families in their fixed colour order; a family IDA returns that this dashboard does not know
 * yet is appended at the end (raw key, muted dashed line) instead of being dropped.
 */
function orderedFamilies(families: ReadonlyArray<StatusFamily>) {
    const byName = new Map(families.map(family => [family.family, family]));

    const known = PRODUCT_FAMILIES.flatMap((name) => {
        const family = byName.get(name);

        return family ? [family] : [];
    });

    return [...known, ...families.filter(family => !KNOWN_FAMILIES.has(family.family))];
}

function FamilyTable({ families }: { families: ReadonlyArray<StatusFamily> }) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Product family</TableHead>
                    <TableHead className="text-right">Availability (7 d)</TableHead>
                    <TableHead className="text-right">p95 latency (7 d, worst day)</TableHead>
                    <TableHead className="text-right">Requests (7 d)</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {families.map(family => (
                    <TableRow key={family.family}>
                        <TableCell>{familyLabel(family.family)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatRatioPercent(family.last_7d.availability)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMs(family.last_7d.p95_ms)}</TableCell>
                        <TableCell className="text-right tabular-nums">{family.last_7d.requests.toLocaleString("en")}</TableCell>
                    </TableRow>
                ))}
                {!families.some(family => family.family === "websocket") && (
                    <TableRow>
                        <TableCell>{familyLabel("websocket")}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-normal" colSpan={3}>{WEBSOCKET_NOTE}</TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}

type FamilyTogglesProps = {
    families: ReadonlyArray<ProductFamily>;
    hidden: ReadonlySet<ProductFamily>;
    onToggle: (family: ProductFamily) => void;
};

/** Family filter chips; each swatch carries the family's fixed series colour, the text stays neutral. */
function FamilyToggles({ families, hidden, onToggle }: FamilyTogglesProps) {
    return (
        <div aria-label="Product families shown in the charts" className="flex flex-wrap gap-2" role="group">
            {families.map((family) => {
                const style = familySeriesStyle(family);

                const shown = !hidden.has(family);

                return (
                    <button
                        aria-pressed={shown}
                        className={cn(
                            "border-border inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
                            shown ? "bg-muted text-foreground" : "text-muted-foreground opacity-60",
                        )}
                        key={family}
                        onClick={() => onToggle(family)}
                        type="button"
                    >
                        <span
                            aria-hidden
                            className={cn("h-0.5 w-3", style.dashed && "border-t-2 border-dashed bg-transparent")}
                            style={style.dashed ? { borderColor: style.color } : { background: style.color }}
                        />
                        {familyLabel(family)}
                    </button>
                );
            })}
        </div>
    );
}

type ApiSectionProps = {
    status: ApiStatusResponse;
};

/** Request health per product family: the 7-day table, then daily p95 and availability charts. */
export function ApiSection({ status }: ApiSectionProps) {
    const [hidden, setHidden] = React.useState<ReadonlySet<ProductFamily>>(() => new Set());

    if (status.api === null) return <StatePanel>Request statistics unavailable</StatePanel>;

    const families = orderedFamilies(status.api.families);

    if (hasNoMeasuredRequests(families)) {
        return (
            <div className="space-y-4">
                <FamilyTable families={families} />
                <StatePanel>No requests measured yet</StatePanel>
            </div>
        );
    }

    const visible = families.filter(family => !hidden.has(family.family));

    const visibleNames = visible.map(family => family.family);

    const todayUtc = utcDayOf(status.generated_at);

    const windowDays = windowDayList(status.generated_at, status.window_days);

    const toggle = (family: ProductFamily) => {
        setHidden((current) => {
            const next = new Set(current);

            if (!next.delete(family)) next.add(family);

            return next;
        });
    };

    return (
        <div className="space-y-6">
            <FamilyTable families={families} />
            <FamilyToggles families={families.map(family => family.family)} hidden={hidden} onToggle={toggle} />
            <div className="grid gap-6 lg:grid-cols-2">
                <FamilyLineChart
                    description="Daily p95 per family (bucket upper bound)"
                    families={visibleNames}
                    formatValue={formatMsAxis}
                    rows={familyDayRows(visible, "p95_ms", windowDays)}
                    title="p95 latency"
                    todayUtc={todayUtc}
                />
                <FamilyLineChart
                    description="Daily share of non-5xx responses"
                    families={visibleNames}
                    formatValue={formatAvailabilityAxis}
                    rows={familyDayRows(visible, "availability", windowDays)}
                    title="Availability"
                    todayUtc={todayUtc}
                    yDomain={["auto", 100]}
                />
            </div>
            <p className="text-muted-foreground text-xs">{status.measurement.note}</p>
        </div>
    );
}
