import * as React from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { CallTabProps } from "../call-tabs";
import type { GuidanceHistoryTarget } from "./guidance-history-panel";

import { GuidanceHistoryPanel } from "./guidance-history-panel";
import { GuidanceTable } from "./guidance-table";
import { KpiHistoryPanel } from "./kpi-history-panel";
import { KpiTable } from "./kpi-table";

type Kind = "guidance" | "kpi";

/**
 * Guidance & KPIs tab: forward guidance (consolidated items with citations and a per-metric
 * history) or every reported KPI with its SEC filing link and a per-KPI history across the company's calls
 * (`/v1/guidance?event=` | `/v1/kpis?event=`; histories `/v1/guidance?company=` | `/v1/kpis?company=&metric=`).
 */
export function GuidanceTab({ event, eventId, historicalTicker }: CallTabProps) {
    const [kind, setKind] = React.useState<Kind>("guidance");

    const [history, setHistory] = React.useState<GuidanceHistoryTarget | null>(null);

    const [kpiHistory, setKpiHistory] = React.useState<null | string>(null);

    return (
        <div className="flex flex-col gap-3">
            <Tabs onValueChange={value => setKind(value as Kind)} value={kind}>
                <TabsList>
                    <TabsTrigger value="guidance">Guidance</TabsTrigger>
                    <TabsTrigger value="kpi">KPIs</TabsTrigger>
                </TabsList>
            </Tabs>

            {kind === "guidance"
                ? (
                        <GuidanceTable
                            eventId={eventId}
                            // Only a normalized metric has a history (the table offers no click otherwise).
                            onMetricClick={item => item.metric_normalized && setHistory({
                                basis: item.basis,
                                metric: item.metric_normalized,
                                periodKind: item.period_kind,
                            })}
                        />
                    )
                : <KpiTable eventId={eventId} onMetricClick={setKpiHistory} />}

            <GuidanceHistoryPanel company={event.cik} historicalTicker={historicalTicker} onClose={() => setHistory(null)} target={history} />
            <KpiHistoryPanel company={event.cik} historicalTicker={historicalTicker} metric={kpiHistory} onClose={() => setKpiHistory(null)} />
        </div>
    );
}
