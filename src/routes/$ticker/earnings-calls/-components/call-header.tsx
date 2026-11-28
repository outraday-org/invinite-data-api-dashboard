import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import * as React from "react";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { V2Event } from "@/lib/api/types";

import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { Badge } from "@/components/ui/badge";
import { Copyable } from "@/components/ui/copy-button";
import { usePageHeadingLevel } from "@/components/ui/page-header";
import { Stat, StatGrid } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eventLabel, formatInstant, SESSION_LABELS } from "@/lib/earnings/format";
import { callTimeSourceLabel } from "@/lib/earnings/labels";
import { formatDay } from "@/lib/format";

import { AvailabilityIcons } from "./availability-icons";
import { CallStatusBadge } from "./call-status-badge";
import { callTimeShort } from "./call-time";
import { EventTypeBadge } from "./event-type-badge";

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
        <span className="inline-flex flex-wrap items-baseline gap-x-2 text-data font-normal">
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
    if (!event.call_time_source) return null;

    return [callTimeSourceLabel(event.call_time_source), event.call_time_confidence ? `${event.call_time_confidence} confidence` : null].filter(Boolean).join(" · ");
}

/** The page title: "Q4 FY2026 earnings call"; another event by its title ("Investor Day 2026"). */
export function callTitle(event: Pick<V2Event, "event_title" | "event_type" | "fiscal_quarter" | "fiscal_year">) {
    return event.event_type === "earnings_call" ? `${eventLabel(event)} earnings call` : eventLabel(event);
}

/** "Nov 2, 2026 · 11:00 PM CET" in the viewer's zone (a short zone name, F13); a date-only call: its day + "date only". */
function callTimeText(event: Pick<V2Event, "call_time_source" | "scheduled_at" | "tz">) {
    return event.call_time_source === null ? `${callTimeShort(event)} · date only` : callTimeShort(event);
}

/**
 * Call header (ui-redesign task 10): the title (`h2` under the ticker header) with the event-type and status badges
 * beside it and the page's `actions` (the alert entry point); ONE meta line — the call time in the viewer's zone, the
 * session, where the start time came from and how sure it is (a low confidence is an outlined badge: it may still
 * move); the materials as labelled icons; everything else in one "Details" disclosure (closed): results released,
 * started, ended, rescheduled, why an expired row expired, the results filing (8-K / 6-K) and the periodic report
 * (10-Q / 10-K) — each opens in the SEC documents panel, with its EDGAR index —, the IR webcast page, the event id
 * (with its copy button: every `/v1/events/{event_id}/…` request names it) and the API's call-time observations.
 * `pageSymbol` = the URL's ticker: a call of another symbol (the event id is authoritative) names its company first.
 */
export function CallHeader({ actions, event, live = false, pageSymbol }: { actions?: React.ReactNode; event: V2Event; live?: boolean; pageSymbol?: string }) {
    const [showDetails, setShowDetails] = React.useState(false);

    const [secTarget, setSecTarget] = React.useState<null | SecPanelTarget>(null);

    const detailsId = React.useId();

    const Heading = usePageHeadingLevel() === 1 ? "h1" : "h2";

    const provenance = callTimeProvenance(event);

    const resultsFiling = event.results_filing ?? null;

    const periodicReport = event.periodic_report ?? null;

    const otherCompany = pageSymbol !== undefined && pageSymbol.toUpperCase() !== event.symbol.toUpperCase();

    const DetailsIcon = showDetails ? ChevronDown : ChevronRight;

    const observations = event.observations ?? [];

    return (
        <header className="flex flex-col gap-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-x-6">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <Heading className="text-xl font-semibold tracking-tight">{callTitle(event)}</Heading>
                    <EventTypeBadge event={event} />
                    <CallStatusBadge event={event} live={live} />
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2 empty:hidden sm:shrink-0 sm:justify-end">{actions}</div>}
            </div>

            <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1">
                {otherCompany && (
                    <>
                        <span className="text-foreground">{`${event.company_name} · ${event.symbol}`}</span>
                        <span aria-hidden>·</span>
                    </>
                )}
                <span className="tabular-nums">{callTimeText(event)}</span>
                {event.session && (
                    <>
                        <span aria-hidden>·</span>
                        <span>{SESSION_LABELS[event.session].toLowerCase()}</span>
                    </>
                )}
                {provenance && (
                    <>
                        <span aria-hidden>·</span>
                        {event.call_time_confidence === "low"
                            // A low-confidence start time is marked: it may still move.
                            ? <Badge title="The start time may still change" variant="outline">{provenance}</Badge>
                            : <span>{provenance}</span>}
                    </>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-muted-foreground">Materials</span>
                <AvailabilityIcons event={event} labelled />
            </div>

            {event.event_type !== "earnings_call" && (event.has_audio || event.has_transcript) && (
                <div className="text-muted-foreground">Recorded from the company&apos;s public webcast.</div>
            )}

            <div className="flex flex-col gap-3">
                <button
                    aria-controls={detailsId}
                    aria-expanded={showDetails}
                    className="text-muted-foreground hover:text-foreground -ml-0.5 flex w-fit items-center gap-1 max-sm:min-h-9"
                    onClick={() => setShowDetails(open => !open)}
                    type="button"
                >
                    <DetailsIcon className="size-3.5" />
                    Details
                </button>
                {showDetails && (
                    <div className="flex flex-col gap-4" id={detailsId}>
                        <StatGrid>
                            {event.results_released_at && <Stat label="Results released" value={formatInstant(event.results_released_at)} />}
                            {event.started_at && <Stat label="Started" value={formatInstant(event.started_at)} />}
                            {event.ended_at && <Stat label="Ended" value={formatInstant(event.ended_at)} />}
                            {event.reschedule_count > 0 && <Stat label="Rescheduled" value={`${event.reschedule_count}×`} />}
                            {resultsFiling && (
                                <Stat
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
                                <Stat
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
                            {event.webcast_url && (
                                <Stat
                                    label="Webcast"
                                    value={(
                                        <a className="text-data font-normal underline underline-offset-4" href={event.webcast_url} rel="noopener noreferrer" target="_blank">
                                            IR webcast page
                                        </a>
                                    )}
                                />
                            )}
                            <Stat
                                label="Event id"
                                value={(
                                    <Copyable label="Copy event id" value={event.event_id}>
                                        <code className="font-mono text-xs font-normal break-all">{event.event_id}</code>
                                    </Copyable>
                                )}
                            />
                        </StatGrid>

                        {observations.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <span className="text-muted-foreground text-xs">{`Call-time observations (${observations.length})`}</span>
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
                                        {observations.map(observation => (
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
                            </div>
                        )}
                    </div>
                )}
            </div>

            <SecSourceDialog onClose={() => setSecTarget(null)} target={secTarget} />
        </header>
    );
}
