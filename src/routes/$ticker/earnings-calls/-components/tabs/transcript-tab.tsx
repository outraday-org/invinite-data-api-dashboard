import { Copy, GitCompare } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { EarningsEventSelector } from "@/lib/api/queries";
import type { EarningsTranscriptFormat, EarningsTranscriptVersion } from "@/lib/api/types";
import type { TranscriptView } from "@/lib/earnings/transcript";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEarningsTranscript, useEarningsTranscriptDiff, useEarningsTranscriptVersions } from "@/lib/api/queries";
import { formatInstant, formatMs } from "@/lib/earnings/format";
import { scrollToTurn } from "@/lib/earnings/scroll-to-turn";
import { toTranscriptView, transcriptPlainText } from "@/lib/earnings/transcript";

import type { CallTabProps } from "../call-tabs";

import { MediaState, Notice } from "../media-state";
import { QaStart, TranscriptTurns } from "./transcript-turns";

// `words` is not rendered (the CLI exposes it; the live view is word-less too).
type RenderedFormat = Exclude<EarningsTranscriptFormat, "words">;

// "Jump to transcript" needs timed turns (`data-start-ms`); the other formats switch to this one.
const LOCATING_FORMAT: RenderedFormat = "speakers";

const FORMATS: Array<{ label: string; value: RenderedFormat }> = [
    { label: "Speakers", value: "speakers" },
    { label: "Sections", value: "sections" },
    { label: "Cleaned", value: "cleaned" },
    { label: "Plain text", value: "text" },
];

function versionLabel(version: EarningsTranscriptVersion) {
    return [
        `Version ${version.version}`,
        version.version_kind,
        formatInstant(version.published_at),
        version.change_note,
    ].filter(Boolean).join(" · ");
}

function TranscriptDiff({ from, selector, to }: { from: number; selector: EarningsEventSelector; to: number }) {
    const { data, error, isLoading } = useEarningsTranscriptDiff({ ...selector, from, to });

    if (error) return <ErrorState error={error} title="Failed to compare transcript versions" />;

    if (isLoading || !data) return <Skeleton className="h-24 w-full" />;

    return (
        <div className="flex flex-col gap-2">
            <div className="text-muted-foreground">
                +
                {data.stats.added_words}
                {" "}
                words · −
                {data.stats.removed_words}
                {" "}
                words
                {data.truncated && " · list truncated (the API caps the changes it returns)"}
            </div>
            {data.changes.length === 0
                ? <div className="text-muted-foreground">No word changes between these versions.</div>
                : (
                        <ScrollArea className="h-[60vh]">
                            <div className="flex flex-col gap-1.5 pr-3">
                                {data.changes.map((change, index) => (
                                    // Changes have no id; their order within one diff is stable.
                                    <div className="flex items-start gap-2" key={index}>
                                        <Badge variant={change.op === "add" ? "secondary" : "destructive"}>
                                            {change.op === "add" ? "+" : "−"}
                                        </Badge>
                                        <span className="text-muted-foreground w-12 shrink-0 tabular-nums">
                                            {change.at_ms === null ? "—" : formatMs(change.at_ms)}
                                        </span>
                                        <span className={change.op === "del" ? "line-through" : undefined}>{change.text}</span>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
        </div>
    );
}

function TranscriptBody({
    error,
    format,
    qaStartMs,
    view,
}: {
    error: Error | null;
    format: RenderedFormat;
    qaStartMs: null | number;
    view: null | TranscriptView;
}) {
    if (error) {
        return (
            <MediaState
                error={error}
                notFound={format === "cleaned"
                    ? "No cleaned layer for this version — pick another format"
                    : "Transcript is being prepared"}
                title="Failed to load the transcript"
            />
        );
    }

    if (!view) return <Skeleton className="h-40 w-full" />;

    if (view.kind === "empty") return <Notice title="Transcript is being prepared" />;

    return <TranscriptTurns qaStartMs={qaStartMs} view={view} />;
}

/**
 * Transcript tab: format switch, published versions (+ a diff against the current one), the
 * turns with timestamps that play the recording, where the Q&A starts, and a copy button.
 * A pending "Jump to transcript" (`transcriptJump`) scrolls to its turn once the transcript is
 * in; a format that cannot locate a passage (sections, plain text, a missing cleaned layer)
 * switches to Speakers first, and a passage that still cannot be found gets a short notice.
 */
export function TranscriptTab({ onTranscriptJumpHandled, selector, transcriptJump }: CallTabProps) {
    const [format, setFormat] = React.useState<RenderedFormat>("speakers");

    // null = the current version (no `version` parameter).
    const [selectedVersion, setSelectedVersion] = React.useState<null | number>(null);

    const [compareOpen, setCompareOpen] = React.useState(false);

    const versions = useEarningsTranscriptVersions(selector);

    const transcript = useEarningsTranscript({ ...selector, format, version: selectedVersion ?? undefined });

    const view = React.useMemo(
        () => (transcript.data ? toTranscriptView(transcript.data.format, transcript.data.data) : null),
        [transcript.data],
    );

    // The answer for the format on screen (a switched format is loading until its own arrives).
    const shown = transcript.data?.format === format ? transcript.data : undefined;

    React.useEffect(() => {
        if (!transcriptJump) return;

        const canSwitch = format !== LOCATING_FORMAT;

        if (transcript.error) {
            if (canSwitch) {
                setFormat(LOCATING_FORMAT);

                return;
            }

            toast.info("The transcript could not be loaded to locate this passage");

            onTranscriptJumpHandled();

            return;
        }

        if (!shown || !view) return;

        if (view.kind !== "turns") {
            if (canSwitch) {
                setFormat(LOCATING_FORMAT);

                return;
            }

            toast.info("This transcript has no turns to locate the passage in");

            onTranscriptJumpHandled();

            return;
        }

        onTranscriptJumpHandled();

        if (!view.turns.some(turn => turn.start_ms !== null)) {
            toast.info("This transcript has no timings — the passage cannot be located");

            return;
        }

        // The turns are rendered in this commit; the short poll only covers a slow paint.
        void scrollToTurn(transcriptJump.ms, 2000).then((found) => {
            if (!found) toast.info("The passage could not be found in the transcript");
        });
    }, [format, onTranscriptJumpHandled, shown, transcript.error, transcriptJump, view]);

    const versionList = [...(versions.data?.versions ?? [])].sort((a, b) => b.version - a.version);

    const currentVersion = versions.data?.current_version ?? null;

    const shownVersion = selectedVersion ?? currentVersion;

    // Compare the picked version with the current one; on the current one, its predecessor.
    const compareFrom = shownVersion !== null && shownVersion !== currentVersion
        ? shownVersion
        : versionList.find(version => currentVersion !== null && version.version < currentVersion)?.version ?? null;

    const compare = versionList.length >= 2 && currentVersion !== null && compareFrom !== null
        ? { from: compareFrom, to: currentVersion }
        : null;

    const shownEntry = versionList.find(version => version.version === shownVersion);

    const copy = async () => {
        if (!view) return;

        try {
            await navigator.clipboard.writeText(transcriptPlainText(view));

            toast.success("Transcript copied");
        }
        catch {
            toast.error("Could not copy the transcript");
        }
    };

    const data = transcript.data;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Tabs onValueChange={value => setFormat(value as RenderedFormat)} value={format}>
                    <TabsList>
                        {FORMATS.map(option => (
                            <TabsTrigger key={option.value} value={option.value}>
                                {option.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                {versionList.length > 0 && (
                    <Select
                        onValueChange={(value) => {
                            const version = Number(value);

                            setSelectedVersion(version === currentVersion ? null : version);
                        }}
                        value={shownVersion === null ? "" : String(shownVersion)}
                    >
                        <SelectTrigger className="max-w-md">
                            <span className="truncate">{shownEntry ? versionLabel(shownEntry) : "Version"}</span>
                        </SelectTrigger>
                        <SelectContent>
                            {versionList.map(version => (
                                <SelectItem key={version.version} value={String(version.version)}>
                                    {versionLabel(version)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {compare && (
                    <Button onClick={() => setCompareOpen(true)} size="sm" type="button" variant="outline">
                        <GitCompare />
                        Compare with current
                    </Button>
                )}

                <Button disabled={!view || view.kind === "empty"} onClick={() => void copy()} size="sm" type="button" variant="ghost">
                    <Copy />
                    Copy
                </Button>
            </div>

            {data && (
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">{data.version_kind}</Badge>
                    <span>
                        {data.word_count.toLocaleString("en-US")}
                        {" "}
                        words
                    </span>
                    <span>
                        ·
                        {" "}
                        {data.transcript_provider}
                    </span>
                    <span>
                        · published
                        {" "}
                        {formatInstant(data.published_at)}
                    </span>
                    {data.qa_start_ms !== null && (
                        <span className="inline-flex items-baseline gap-1">
                            ·
                            <QaStart qaStartMs={data.qa_start_ms} />
                        </span>
                    )}
                </div>
            )}

            {data?.stt_provider === "company_document" && (
                <div className="text-muted-foreground text-xs">Company-published transcript (no audio timings)</div>
            )}

            <TranscriptBody error={transcript.error} format={format} qaStartMs={data?.qa_start_ms ?? null} view={view} />

            {compare && (
                <Dialog onOpenChange={setCompareOpen} open={compareOpen}>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                Version
                                {" "}
                                {compare.from}
                                {" "}
                                → version
                                {" "}
                                {compare.to}
                            </DialogTitle>
                            <DialogDescription>Words added and removed, with their position in the call.</DialogDescription>
                        </DialogHeader>
                        {compareOpen && <TranscriptDiff from={compare.from} selector={selector} to={compare.to} />}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
