import type { EarningsParticipant } from "@/lib/api/types";
import type { RoleGroup } from "@/lib/earnings/labels";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEarningsParticipants } from "@/lib/api/queries";
import {
    participationDetailText,
    participationKindLabel,
    percent,
    ROLE_GROUP_LABELS,
    ROLE_GROUPS,
    roleGroup,
} from "@/lib/earnings/labels";

import type { CallTabProps } from "../call-tabs";

import { MediaState, NO_TRANSCRIPT_TITLE, Notice } from "../media-state";
import { SeekButton } from "../seek-button";

function Evidence({ evidence }: { evidence: EarningsParticipant["evidence"] }) {
    if (!evidence || evidence.length === 0) return <span className="text-muted-foreground">—</span>;

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

function ParticipantRows({ group, participants }: { group: RoleGroup; participants: Array<EarningsParticipant> }) {
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
 * Participants tab: the call's speakers grouped by role (management = executives + IR host)
 * with how each name was resolved and its evidence, then the participation flags vs the
 * prior call (new CFO, first appearances, …).
 */
export function ParticipantsTab({ selector }: CallTabProps) {
    const { data, error, isLoading } = useEarningsParticipants({ ...selector, include: "evidence" });

    if (error) return <MediaState error={error} notFound={NO_TRANSCRIPT_TITLE} title="Failed to load participants" />;

    if (isLoading || !data) return <Skeleton className="h-40 w-full" />;

    const names = new Map(data.participants.filter(p => p.person_id && p.name).map(p => [p.person_id, p.name] as const));

    const grouped = ROLE_GROUPS.map(group => ({
        group,
        participants: data.participants.filter(participant => roleGroup(participant.role) === group),
    }));

    return (
        <div className="flex flex-col gap-4">
            {data.participants.length === 0
                ? <Notice title="No participants identified yet" />
                : (
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
                                {grouped.map(({ group, participants }) => (
                                    <ParticipantRows group={group} key={group} participants={participants} />
                                ))}
                            </TableBody>
                        </Table>
                    )}

            <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Participation vs the prior call</h3>
                {data.participation_events.length === 0
                    ? <div className="text-muted-foreground">No participation changes.</div>
                    : (
                            <ul className="flex flex-col gap-1">
                                {data.participation_events.map((item, index) => {
                                    const who = item.person_id ? names.get(item.person_id) : undefined;

                                    const detail = participationDetailText(item.detail);

                                    return (
                                        // Events have no id; their order within one call is stable.
                                        <li className="flex flex-wrap items-center gap-2" key={index}>
                                            <Badge variant="secondary">{participationKindLabel(item.kind)}</Badge>
                                            {who && <span className="font-medium">{who}</span>}
                                            {detail && <span className="text-muted-foreground">{detail}</span>}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
            </section>
        </div>
    );
}
