import * as React from "react";
import { ResponsiveContainer } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Shared recharts styling of the status page: recessive grid, muted ticks, theme-aware tooltip.
export const CHART_MARGIN = { bottom: 4, left: 4, right: 16, top: 8 };

export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };

export const GRID_STROKE = "var(--border)";

export const LINE_CURSOR = { stroke: "var(--muted-foreground)" };

export const BAR_CURSOR = { fill: "var(--muted)" };

export const TOOLTIP_CONTENT_STYLE: React.CSSProperties = {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
    fontSize: 12,
};

/** Legend entries in the body text colour: series colour belongs to the swatch, never to text. */
export function legendText(value: string) {
    return <span className="text-foreground text-xs">{value}</span>;
}

type ChartFrameProps = {
    children: React.ReactElement;
    description?: React.ReactNode;
    height?: number;
    title: React.ReactNode;
};

export function ChartFrame({ children, description, height = 240, title }: ChartFrameProps) {
    return (
        <figure className="space-y-2">
            <figcaption className="space-y-0.5">
                <div className="text-sm font-medium">{title}</div>
                {description && <div className="text-muted-foreground text-xs">{description}</div>}
            </figcaption>
            <div style={{ height }}>
                <ResponsiveContainer height="100%" width="100%">
                    {children}
                </ResponsiveContainer>
            </div>
        </figure>
    );
}

/** A section-level state ("unavailable", "no data yet") in place of a section's tables and charts. */
export function StatePanel({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <Card className={cn("border-dashed", className)} role="status" size="sm">
            <CardContent className="text-muted-foreground py-6 text-center text-sm">
                {children}
            </CardContent>
        </Card>
    );
}
