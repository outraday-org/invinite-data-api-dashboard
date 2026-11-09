import type { V2Participation } from "@/lib/api/types";
import type { RoleGroup } from "@/lib/earnings/labels";

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
                    <TableCell className="font-medium">{participant.name ?? <span className="text-muted-foreground">Unnamed</span>}</TableCell>
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

/**
 * Participants tab: the call's speakers (`/v2/participants?event=`) grouped by role (management = executives + IR host)
 * with how each name was resolved and its evidence. v2 serves no participation flags vs the prior call (new CFO, first
 * appearances): that section of v1 is gone.
 */
export function ParticipantsTab({ eventId }: CallTabProps) {
    const { data, error, isLoading } = useV2Participants(eventId);

    if (error) return <MediaState error={error} notFound={NO_TRANSCRIPT_TITLE} title="Failed to load participants" />;

    if (isLoading || !data) return <Skeleton className="h-40 w-full" />;

    const participants = data.data;

    const grouped = ROLE_GROUPS.map(group => ({
        group,
        participants: participants.filter(participant => roleGroup(participant.role) === group),
    }));

    if (participants.length === 0) return <Notice title="No participants identified yet" />;

    return (
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
    );
}
