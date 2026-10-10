import * as React from "react";

import type { EarningsProsodySection, EarningsProsodySpeaker } from "@/lib/api/types";

import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEarningsProsody } from "@/lib/api/queries";
import { formatMs } from "@/lib/earnings/format";
import { formatDecimal, percent } from "@/lib/earnings/labels";

import type { CallTabProps } from "../call-tabs";

import { MediaState, Notice } from "../media-state";

const SECTIONS: Array<{ label: string; value: EarningsProsodySection }> = [
    { label: "Whole call", value: "all" },
    { label: "Prepared remarks", value: "prepared" },
    { label: "Q&A", value: "qa" },
];

/** The aggregate row's speaker label. */
const ALL_SPEAKERS_LABEL = "*";

const ACOUSTIC_UNAVAILABLE = "acoustic features unavailable for this call";

const msOrDash = (ms: null | number) => (ms === null ? "—" : `${formatDecimal(ms / 1000, 2)} s`);

/** Pitch / energy: "—" with a tooltip when the audio was not analysed. */
function AcousticCell({ available, value }: { available: boolean; value: string }) {
    if (available) return <TableCell className="tabular-nums">{value}</TableCell>;

    return (
        <TableCell>
            <Tooltip>
                <TooltipTrigger className="text-muted-foreground" render={<span />}>—</TooltipTrigger>
                <TooltipContent>{ACOUSTIC_UNAVAILABLE}</TooltipContent>
            </Tooltip>
        </TableCell>
    );
}

function SpeakerRow({ row, showAnswerTiming }: { row: EarningsProsodySpeaker; showAnswerTiming: boolean }) {
    const aggregate = row.speaker.label === ALL_SPEAKERS_LABEL;

    const detail = [row.speaker.title, row.speaker.role?.replaceAll("_", " ")].filter(Boolean).join(" · ");

    return (
        <TableRow className={aggregate ? "bg-muted/40 font-medium" : undefined}>
            <TableCell className="whitespace-normal">
                <div className="flex flex-col">
                    <span className="font-medium">{aggregate ? "All speakers" : row.speaker.name ?? `Speaker ${row.speaker.label}`}</span>
                    {!aggregate && detail && <span className="text-muted-foreground font-normal">{detail}</span>}
                </div>
            </TableCell>
            <TableCell className="tabular-nums">{formatDecimal(row.speech_rate_wpm, 0)}</TableCell>
            <TableCell className="tabular-nums">
                {row.pause_count ?? "—"}
                <span className="text-muted-foreground">{` · ${msOrDash(row.pause_mean_ms)} · ${msOrDash(row.pause_p95_ms)}`}</span>
            </TableCell>
            <TableCell className="tabular-nums">{percent(row.filler_rate)}</TableCell>
            {showAnswerTiming && (
                <TableCell className="tabular-nums">{`${msOrDash(row.time_to_answer_mean_ms)} · ${msOrDash(row.time_to_answer_p95_ms)}`}</TableCell>
            )}
            <AcousticCell
                available={row.acoustic_available}
                value={`${formatDecimal(row.pitch_mean_hz, 0)} / ${formatDecimal(row.pitch_sd_hz, 0)} Hz`}
            />
            <AcousticCell available={row.acoustic_available} value={`${formatDecimal(row.energy_mean_db, 1)} dB`} />
            <TableCell className="tabular-nums">{formatMs(row.spoken_ms)}</TableCell>
            <TableCell className="tabular-nums">{row.word_count.toLocaleString("en-US")}</TableCell>
        </TableRow>
    );
}

/** Prosody tab: per-speaker delivery features of one section, the "All speakers" row first. */
export function ProsodyTab({ selector }: CallTabProps) {
    const [section, setSection] = React.useState<EarningsProsodySection>("all");

    const { data, error, isLoading } = useEarningsProsody({ ...selector, section });

    const rows = React.useMemo(() => {
        const speakers = data?.speakers ?? [];

        return [
            ...speakers.filter(row => row.speaker.label === ALL_SPEAKERS_LABEL),
            ...speakers.filter(row => row.speaker.label !== ALL_SPEAKERS_LABEL),
        ];
    }, [data]);

    // Time to answer exists only for answers, i.e. the Q&A.
    const showAnswerTiming = section === "qa";

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
                <Tabs onValueChange={value => setSection(value as EarningsProsodySection)} value={section}>
                    <TabsList>
                        {SECTIONS.map(option => (
                            <TabsTrigger key={option.value} value={option.value}>
                                {option.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                {/* The API's caveat (`PROSODY_CAVEAT`). */}
                <span className="text-muted-foreground">Prosody is a volatility signal, not a direction signal.</span>
            </div>

            {error
                ? <MediaState error={error} notFound="Prosody is not derived for this call yet" title="Failed to load prosody" />
                : isLoading || !data
                    ? <Skeleton className="h-40 w-full" />
                    : rows.length === 0
                        ? <Notice title="No prosody features for this section" />
                        : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Speaker</TableHead>
                                            <TableHead>Speech rate (wpm)</TableHead>
                                            <TableHead>Pauses (count · mean · p95)</TableHead>
                                            <TableHead>Fillers</TableHead>
                                            {showAnswerTiming && <TableHead>Time to answer (mean · p95)</TableHead>}
                                            <TableHead>Pitch mean / SD</TableHead>
                                            <TableHead>Energy</TableHead>
                                            <TableHead>Spoken</TableHead>
                                            <TableHead>Words</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map(row => (
                                            <SpeakerRow key={row.speaker.label} row={row} showAnswerTiming={showAnswerTiming} />
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
        </div>
    );
}
