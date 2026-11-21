import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import * as React from "react";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { V2Event } from "@/lib/api/types";

import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { Badge } from "@/components/ui/badge";
import { Copyable } from "@/components/ui/copy-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eventLabel, formatInstant, SESSION_LABELS } from "@/lib/earnings/format";
import { EXPIRED_REASON_LABELS } from "@/lib/earnings/labels";
import { formatDay } from "@/lib/format";

import { AvailabilityIcons } from "./availability-icons";
import { CallStatusBadge } from "./call-status-badge";
import { CallTime } from "./call-time";
import { EventTypeBadge } from "./event-type-badge";

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-[0.625rem] uppercase tracking-wide">{label}</span>
            <span className="text-xs">{value}</span>
        </div>
    );
}

type ResultsFiling = NonNullable<V2Event["results_filing"]>;

type PeriodicReport = NonNullable<V2Event["periodic_report"]>;

/** A filing of the call: the form opens it in the SEC documents panel (by accession), the EDGAR index beside it. */
function FilingFact({
    detail,
    filing,
    onOpen,
}: {
    detail: null | string;
    filing: PeriodicReport | ResultsFiling;
    onOpen: (target: SecPanelTarget) => void;
}) {
    return (
        <span className="inline-flex flex-wrap items-baseline gap-x-2">
            <button
                className="font-medium underline underline-offset-4"
                onClick={() => onOpen({ accession: filing.accession, kind: "filing", title: `${filing.form} · ${filing.accession}` })}
                title={`Open the ${filing.form} in the SEC documents panel`}
                type="button"
            >
                {filing.form}
            </button>
            {detail && <span className="text-muted-foreground">{detail}</span>}
            {filing.edgar_index_url && (
                <a className="text-muted-foreground inline-flex items-center gap-0.5 underline-offset-4 hover:underline" href={filing.edgar_index_url} rel="noopener noreferrer" target="_blank">
                    EDGAR
                    <ExternalLink className="size-3" />
                </a>
            )}
        </span>
    );
}

/** Where the start time came from and how sure it is ("edgar · high confidence"); nothing for a date-only call. */
function callTimeProvenance(event: Pick<V2Event, "call_time_confidence" | "call_time_source">) {
    if (event.call_time_source === null) return null;

    return [event.call_time_source, event.call_time_confidence ? `${event.call_time_confidence} confidence` : null].filter(Boolean).join(" · ");
}

/**
 * Call header: company, period, time, status, materials, lifecycle times, the IR webcast page, the event id (with
 * its copy button: every `/v1/events/{event_id}/…` request names it) and the API's call-time provenance
 * (`observations[]`, collapsed — shown because this is the example app). O7 group 5: the start time's source and
 * confidence (a low one is marked), why an expired row expired, and the results filing (the earnings 8-K / 6-K) and
 * the periodic report (10-Q / 10-K) — each opens in the SEC documents panel, with its EDGAR index.
 */
export function CallHeader({ event }: { event: V2Event }) {
    const [showObservations, setShowObservations] = React.useState(false);

    const [secTarget, setSecTarget] = React.useState<null | SecPanelTarget>(null);

    const provenance = callTimeProvenance(event);

    const resultsFiling = event.results_filing ?? null;

    const periodicReport = event.periodic_report ?? null;

    const ObservationsIcon = showObservations ? ChevronDown : ChevronRight;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-medium">{event.company_name}</span>
                <Badge variant="outline">{event.symbol}</Badge>
                <span className="text-muted-foreground">{eventLabel(event)}</span>
                <EventTypeBadge event={event} />
                <CallStatusBadge event={event} />
            </div>

            {event.event_type !== "earnings_call" && (event.has_audio || event.has_transcript) && (
                <div className="text-muted-foreground text-xs">Recorded from the company&apos;s public webcast.</div>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Fact
                    label="Call time"
                    value={(
                        <div className="flex flex-col">
                            <CallTime event={event} />
                            {provenance && (event.call_time_confidence === "low"
                                // A low-confidence start time is marked: it may still move.
                                ? <Badge className="mt-0.5 w-fit" title="The start time may still change" variant="outline">{provenance}</Badge>
                                : <span className="text-muted-foreground text-[0.625rem]">{provenance}</span>)}
                        </div>
                    )}
                />
                <Fact label="Session" value={event.session ? SESSION_LABELS[event.session] : "—"} />
                <Fact label="Materials" value={<AvailabilityIcons event={event} />} />
                {event.results_released_at && <Fact label="Results released" value={formatInstant(event.results_released_at)} />}
                {event.started_at && <Fact label="Started" value={formatInstant(event.started_at)} />}
                {event.ended_at && <Fact label="Ended" value={formatInstant(event.ended_at)} />}
                {event.reschedule_count > 0 && <Fact label="Rescheduled" value={`${event.reschedule_count}×`} />}
                {event.expired_reason && <Fact label="Expired" value={EXPIRED_REASON_LABELS[event.expired_reason]} />}
                {resultsFiling && (
                    <Fact
                        label="Results filing"
                        value={(
                            <FilingFact
                                detail={resultsFiling.accepted_at ? `accepted ${formatInstant(resultsFiling.accepted_at)}` : null}
                                filing={resultsFiling}
                                onOpen={setSecTarget}
                            />
                        )}
                    />
                )}
                {periodicReport && (
                    <Fact
                        label="Periodic report"
                        value={(
                            <FilingFact
                                detail={[
                                    periodicReport.period_end ? `period ending ${formatDay(periodicReport.period_end)}` : null,
                                    periodicReport.filing_date ? `filed ${formatDay(periodicReport.filing_date)}` : null,
                                ].filter(Boolean).join(" · ") || null}
                                filing={periodicReport}
                                onOpen={setSecTarget}
                            />
                        )}
                    />
                )}
                <Fact
                    label="Event id"
                    value={(
                        <Copyable label="Copy event id" value={event.event_id}>
                            <code className="font-mono text-[0.6875rem] break-all">{event.event_id}</code>
                        </Copyable>
                    )}
                />
                {event.webcast_url && (
                    <Fact
                        label="Webcast"
                        value={(
                            <a className="underline underline-offset-4" href={event.webcast_url} rel="noopener noreferrer" target="_blank">
                                IR webcast page
                            </a>
                        )}
                    />
                )}
            </div>

            {(event.observations?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-2">
                    <button
                        aria-expanded={showObservations}
                        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-xs"
                        onClick={() => setShowObservations(open => !open)}
                        type="button"
                    >
                        <ObservationsIcon className="size-3.5" />
                        Call-time observations (
                        {event.observations?.length}
                        )
                    </button>
                    {showObservations && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Observed</TableHead>
                                    <TableHead>Starts at</TableHead>
                                    <TableHead>Status hint</TableHead>
                                    <TableHead>Announcement</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {event.observations?.map(observation => (
                                    <TableRow key={`${observation.observed_source}:${observation.observed_at}:${observation.starts_at ?? ""}`}>
                                        <TableCell>{observation.observed_source}</TableCell>
                                        <TableCell className="tabular-nums">{formatInstant(observation.observed_at)}</TableCell>
                                        <TableCell className="tabular-nums">
                                            {observation.starts_at ? formatInstant(observation.starts_at) : "date only"}
                                        </TableCell>
                                        <TableCell>{observation.status_hint ?? "—"}</TableCell>
                                        <TableCell>{observation.announcement_kind ?? "—"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            )}

            <SecSourceDialog onClose={() => setSecTarget(null)} target={secTarget} />
        </div>
    );
}
