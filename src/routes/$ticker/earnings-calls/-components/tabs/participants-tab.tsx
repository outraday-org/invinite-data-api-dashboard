import { Link } from "@tanstack/react-router";

import type { V2Participation } from "@/lib/api/types";
import type { RoleGroup } from "@/lib/earnings/labels";

import { SpeakerAvatar } from "@/components/earnings/speaker-avatar";
import { PersonLink } from "@/components/people/person-link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useV2Participants } from "@/lib/api/queries";
import {
    percent,
    ROLE_GROUP_LABELS,
    ROLE_GROUPS,
    roleGroup,
} from "@/lib/earnings/labels";

import type { CallTabProps } from "../call-tabs";

import { MediaState, NO_TRANSCRIPT_TITLE, Notice } from "../media-state";
import { SeekButton } from "../seek-button";

function Evidence({ evidence }: { evidence: V2Participation["evidence"] }) {
    if (evidence.length === 0) return <span className="text-muted-foreground">—</span>;

    const first = evidence[0];

    return (
        <div className="flex items-center gap-2">
            <Tooltip>
                <TooltipTrigger className="max-w-xs text-left" render={<span />}>
                    <span className="line-clamp-1 italic">{`“${first.quote}”`}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                    {evidence.map(item => `“${item.quote}”`).join("\n\n")}
                </TooltipContent>
            </Tooltip>
            <SeekButton startMs={first.start_ms} />
        </div>
    );
}

function ParticipantRows({ group, participants }: { group: RoleGroup; participants: Array<V2Participation> }) {
    if (participants.length === 0) return null;

    return (
        <>
            <TableRow className="hover:bg-transparent">
                <TableCell className="bg-muted/40 font-medium" colSpan={7}>
                    {ROLE_GROUP_LABELS[group]}
                    {" "}
                    <span className="text-muted-foreground font-normal">{participants.length}</span>
                </TableCell>
            </TableRow>
            {participants.map(participant => (
                <TableRow key={participant.speaker_label}>
                    <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                            <SpeakerAvatar imageUrl={participant.image_url} name={participant.name} size="md" speakerRole={participant.role} />
                            {participant.name
                                ? <PersonLink personId={participant.person_id}>{participant.name}</PersonLink>
                                : <span className="text-muted-foreground">Unnamed</span>}
                        </span>
                    </TableCell>
                    <TableCell className="whitespace-normal">{participant.title ?? "—"}</TableCell>
                    <TableCell className="whitespace-normal">{participant.firm ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{participant.speaker_label}</Badge></TableCell>
                    <TableCell className="tabular-nums">{percent(participant.confidence, 0)}</TableCell>
                    <TableCell className="text-muted-foreground">{participant.resolved_by?.replaceAll("_", " ") ?? "—"}</TableCell>
                    <TableCell><Evidence evidence={participant.evidence} /></TableCell>
                </TableRow>
            ))}
        </>
    );
}

/** The people search scoped to this call and to the company's calls (`/people?event=` / `?company=`). */
export function PeopleSearchLinks({ company, eventId, symbol }: { company: string; eventId: string; symbol: string }) {
    const linkClass = "text-muted-foreground hover:text-foreground underline-offset-4 hover:underline";

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Search people:</span>
            <Link className={linkClass} search={{ event: eventId }} to="/people">on this call</Link>
            <Link className={linkClass} search={{ company }} to="/people">{`on every ${symbol} call`}</Link>
        </div>
    );
}

/**
 * Participants tab: the call's speakers (`/v1/participants?event=`) grouped by role (management = executives + IR host)
 * with how each name was resolved and its evidence; a resolved speaker's name opens the person page (`person_id`), and
 * the people search opens scoped to this call or the company. v2 serves no participation flags vs the prior call (new
 * CFO, first appearances): that section of v1 is gone.
 */
export function ParticipantsTab({ event, eventId }: CallTabProps) {
    const { data, error, isLoading } = useV2Participants(eventId);

    if (error) return <MediaState error={error} notFound={NO_TRANSCRIPT_TITLE} operationId="listParticipants" title="Failed to load participants" />;

    if (isLoading || !data) return <Skeleton className="h-40 w-full" />;

    const participants = data.data;

    const grouped = ROLE_GROUPS.map(group => ({
        group,
        participants: participants.filter(participant => roleGroup(participant.role) === group),
    }));

    if (participants.length === 0) return <Notice title="No participants identified yet" />;

    return (
        <div className="flex flex-col gap-3">
            <PeopleSearchLinks company={event.cik} eventId={eventId} symbol={event.symbol} />
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Firm</TableHead>
                        <TableHead>Speaker</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Resolved by</TableHead>
                        <TableHead>Evidence</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {grouped.map(({ group, participants: rows }) => (
                        <ParticipantRows group={group} key={group} participants={rows} />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
