import { ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";

import type { EarningsEventResponse } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eventLabel, formatInstant, SESSION_LABELS } from "@/lib/earnings/format";

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

/**
 * Call header: company, period, time, status, materials, lifecycle times, the IR webcast page
 * and the API's call-time provenance (`observations[]`, collapsed — shown because this is the
 * example app).
 */
export function CallHeader({ event }: { event: EarningsEventResponse }) {
    const [showObservations, setShowObservations] = React.useState(false);

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
                <Fact label="Call time" value={<CallTime event={event} />} />
                <Fact label="Session" value={event.session ? SESSION_LABELS[event.session] : "—"} />
                <Fact label="Materials" value={<AvailabilityIcons event={event} />} />
                {event.results_released_at && <Fact label="Results released" value={formatInstant(event.results_released_at)} />}
                {event.started_at && <Fact label="Started" value={formatInstant(event.started_at)} />}
                {event.ended_at && <Fact label="Ended" value={formatInstant(event.ended_at)} />}
                {event.reschedule_count > 0 && <Fact label="Rescheduled" value={`${event.reschedule_count}×`} />}
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
        </div>
    );
}
