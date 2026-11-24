import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import type { MacroSeries } from "@/lib/api/macro";

import {
    AXIS_TICK,
    CHART_MARGIN,
    ChartFrame,
    GRID_STROKE,
    TOOLTIP_CONTENT_STYLE,
} from "@/components/charts/chart-parts";

export type MacroPoint = { label: string; value: null | number; x?: number };

const millis = 86_400_000;

function skipped(previous: string, next: string, frequency: MacroSeries["frequency"]) {
    const hi = new Date(next + "T00:00:00Z"),
        lo = new Date(previous + "T00:00:00Z");

    if (frequency === "W") return hi.getTime() - lo.getTime() > 7 * millis;

    lo.setUTCMonth(lo.getUTCMonth() + (frequency === "Q" ? 3 : 1));

    return lo < hi;
}

export const historyPoints = (rows: Array<MacroPoint>, frequency: MacroSeries["frequency"]) => {
    const ordered = [...rows].sort((a, b) => a.label.localeCompare(b.label));

    // Treasury history is indexed by published curve dates. A missing tenor on a curve already has a null value.
    if (frequency === "D") return ordered;

    return ordered.flatMap((row, i) =>
        i > 0 && skipped(ordered[i - 1].label, row.label, frequency)
            ? [{ label: "Unreported period", value: null }, row]
            : [row],
    );
};
export const MacroChart = ({
    maturity = false,
    points,
    title,
    unit,
}: {
    points: Array<MacroPoint>;
    title: string;
    unit: string;
    maturity?: boolean;
}) => (
    <ChartFrame description={unit} title={title}>
        <LineChart accessibilityLayer data={points} margin={CHART_MARGIN}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            {maturity
                ? (
                        <XAxis
                            dataKey="x"
                            domain={["dataMin", "dataMax"]}
                            tick={AXIS_TICK}
                            tickFormatter={v => `${v} mo`}
                            type="number"
                        />
                    )
                : (
                        <XAxis dataKey="label" minTickGap={28} tick={AXIS_TICK} />
                    )}
            <YAxis domain={["auto", "auto"]} tick={AXIS_TICK} width={65} />
            <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelFormatter={label => (maturity ? `${label} months` : label)}
            />
            <Line
                connectNulls={false}
                dataKey="value"
                dot={points.length < 32}
                isAnimationActive={false}
                name={unit}
                stroke="var(--series-1)"
                strokeWidth={2}
                type="linear"
            />
        </LineChart>
    </ChartFrame>
);
