import * as React from "react";
import { toast } from "sonner";

import type { TimedWord } from "@/lib/earnings/follow-along";
import type { TranscriptFormat, TranscriptView } from "@/lib/earnings/transcript";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2Participants, useV2Transcript, useV2TranscriptDiff, useV2TranscriptText, useV2TranscriptVersions } from "@/lib/api/queries";
import { callFileStem } from "@/lib/download";
import { timedWordsOfTurns, toWordTurns } from "@/lib/earnings/follow-along";
import { formatMs } from "@/lib/earnings/format";
import { scrollToTurn } from "@/lib/earnings/scroll-to-turn";
import { textAnswerData, toTranscriptView, transcriptPlainText } from "@/lib/earnings/transcript";

import type { CallTabProps } from "../call-tabs";
import type { TranscriptDownloads } from "../transcript/transcript-toolbar";
import type { SpeakerImages } from "./transcript-turns";

import { useCallAudio } from "../audio-context";
import { DEFAULT_TRANSCRIPT_FORMAT } from "../call-search";
import { MediaState, Notice } from "../media-state";
import { recordingFilename } from "../player/recording-player";
import { TranscriptToolbar } from "../transcript/transcript-toolbar";
import { TranscriptTurns, useSpeakerImages } from "./transcript-turns";

// The turns (`/transcript`, raw or cleaned layer) or the text blocks (`/transcript-text`).
type RenderedFormat = TranscriptFormat;

const TURN_FORMATS = new Set<RenderedFormat>(["cleaned", "speakers"]);

// "Jump to transcript" needs timed turns (`data-start-ms`); the other formats switch to this one.
const LOCATING_FORMAT: RenderedFormat = "speakers";

function TranscriptDiff({ eventId, from, to }: { eventId: string; from: number; to: number }) {
    const { data, error, isLoading } = useV2TranscriptDiff({ eventId, from, to });

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
    speakerImages,
    view,
    words,
}: {
    error: Error | null;
    format: RenderedFormat;
    qaStartMs: null | number;
    speakerImages: SpeakerImages;
    view: null | TranscriptView;
    words: null | ReadonlyArray<Array<TimedWord> | null>;
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

    return <TranscriptTurns qaStartMs={qaStartMs} speakerImages={speakerImages} view={view} words={words} />;
}

/**
 * Transcript tab: one toolbar row (format, published versions + a diff against the current one, Download, Copy), the
 * turns on `TurnBlock` — in the Speakers format with their words (`include=words`: highlighted as spoken, any listed
 * version), the cleaned layer turn by turn (its `words` answer empty) —, where the Q&A starts.
 * A pending "Jump to transcript" (`transcriptJump`) scrolls to its turn once the transcript is
 * in; a format that cannot locate a passage (sections, plain text, a missing cleaned layer)
 * switches to Speakers first, and a passage that still cannot be found gets a short notice (a link's `?t=` neither
 * switches nor tells: `fromLink`).
 * The format and the picked version are URL state (`?format=`, `?version=`, O6-final): a reload or a shared link shows
 * the same text; the defaults (Speakers, the current version) are never written.
 */
export function TranscriptTab({ event, eventId, onSearchChange, onTranscriptJumpHandled, search, transcriptJump }: CallTabProps) {
    const format: RenderedFormat = search.format ?? DEFAULT_TRANSCRIPT_FORMAT;

    const setFormat = React.useCallback((next: RenderedFormat) => {
        onSearchChange({ format: next === DEFAULT_TRANSCRIPT_FORMAT ? undefined : next });
    }, [onSearchChange]);

    const [compareOpen, setCompareOpen] = React.useState(false);

    const versions = useV2TranscriptVersions(eventId);

    const listedVersions = versions.data?.data;

    const linkVersion = search.version;

    // A `?version=` waits for the published list before anything is asked: an unlisted one would be a wasted (billed)
    // request, the newest one a second copy of the current version's query (another key than the player's).
    const waitForVersions = linkVersion !== undefined && listedVersions === undefined && !versions.error;

    const newestListed = listedVersions?.reduce<null | number>((newest, entry) => Math.max(newest ?? entry.version, entry.version), null) ?? null;

    // null = the current version (no `version` parameter). A `?version=` the published list does not name, or the newest
    // one, reads as the current one; without a list (its request failed) the link's version is asked as it is.
    const selectedVersion = linkVersion !== undefined
        && linkVersion !== newestListed
        && (listedVersions === undefined || listedVersions.some(entry => entry.version === linkVersion))
        ? linkVersion
        : null;

    const requestedVersion = selectedVersion ?? undefined;

    const turnFormat = TURN_FORMATS.has(format);

    // The id the format's query asks with ("" idles it): nothing before a `?version=` is resolved.
    const askId = waitForVersions ? "" : eventId;

    // Speakers asks with its words: for the current version the very query the player's provider asks once a recording
    // plays (same key = one request). The cleaned layer answers `include=words` with empty word lists (checked
    // 2026-11-21), so it is asked without them.
    const withWords = format === "speakers";

    // One of the two is asked (the other idles on an empty id): turns for Speakers / Cleaned, text for the rest.
    const turns = useV2Transcript({
        eventId: turnFormat ? askId : "",
        layer: format === "cleaned" ? "cleaned" : undefined,
        version: requestedVersion,
        words: withWords || undefined,
    });

    const text = useV2TranscriptText({ eventId: turnFormat ? "" : askId, split: format === "sections" ? "sections" : "none", version: requestedVersion });

    const transcript = turnFormat ? turns : text;

    // The speakers' round images (only the turn formats show speakers); while unanswered every named turn has initials.
    const participants = useV2Participants(turnFormat ? eventId : "");

    const speakerImages = useSpeakerImages(participants.data);

    const view = React.useMemo(() => {
        if (turnFormat) return turns.data ? toTranscriptView(format, turns.data.turns) : null;

        return text.data ? toTranscriptView(format, textAnswerData(text.data, format === "sections" ? "sections" : "text")) : null;
    }, [format, text.data, turnFormat, turns.data]);

    // Every turn's timed words (Speakers only); `null` = turn-level highlight.
    const words = React.useMemo(
        () => (withWords && turns.data ? timedWordsOfTurns(toWordTurns(turns.data.turns)) : null),
        [turns.data, withWords],
    );

    // The answer for the format on screen (each format has its own query, so a switched one loads its own).
    const shown = transcript.data ?? undefined;

    React.useEffect(() => {
        if (!transcriptJump) return;

        // A link's `?t=` keeps the URL's format (a reload restores what the URL says) and tells nothing: a format
        // without timed turns just opens at the top.
        const { fromLink } = transcriptJump;

        const canSwitch = format !== LOCATING_FORMAT && !fromLink;

        const notify = (message: string) => {
            if (!fromLink) toast.info(message);
        };

        if (transcript.error) {
            if (canSwitch) {
                setFormat(LOCATING_FORMAT);

                return;
            }

            notify("The transcript could not be loaded to locate this passage");

            onTranscriptJumpHandled();

            return;
        }

        if (!shown || !view) return;

        if (view.kind !== "turns") {
            if (canSwitch) {
                setFormat(LOCATING_FORMAT);

                return;
            }

            notify("This transcript has no turns to locate the passage in");

            onTranscriptJumpHandled();

            return;
        }

        onTranscriptJumpHandled();

        if (!view.turns.some(turn => turn.start_ms !== null)) {
            notify("This transcript has no timings — the passage cannot be located");

            return;
        }

        // The turns are rendered in this commit; the short poll only covers a slow paint.
        void scrollToTurn(transcriptJump.ms, 2000).then((found) => {
            if (!found) notify("The passage could not be found in the transcript");
        });
    }, [format, onTranscriptJumpHandled, setFormat, shown, transcript.error, transcriptJump, view]);

    const versionList = [...(listedVersions ?? [])].sort((a, b) => b.version - a.version);

    // The current version is the newest published one (what `/transcript` answers without `version`).
    const currentVersion = versionList.at(0)?.version ?? transcript.data?.version ?? null;

    const shownVersion = selectedVersion ?? currentVersion;

    // Compare the picked version with the current one; on the current one, its predecessor.
    const compareFrom = shownVersion !== null && shownVersion !== currentVersion
        ? shownVersion
        : versionList.find(version => currentVersion !== null && version.version < currentVersion)?.version ?? null;

    const compare = versionList.length >= 2 && currentVersion !== null && compareFrom !== null
        ? { from: compareFrom, to: currentVersion }
        : null;

    const shownEntry = versionList.find(version => version.version === shownVersion);

    const { recording } = useCallAudio();

    const downloads: TranscriptDownloads = {
        audio: event.has_audio ? { download: recording ? { filename: recordingFilename(event, recording), url: recording.url } : null } : null,
        baseName: callFileStem(event, shownVersion === null ? "transcript" : `transcript-v${shownVersion}`),
        json: shown ?? null,
        pdf: shownEntry?.pdf ?? null,
        text: view && view.kind !== "empty" ? transcriptPlainText(view) : null,
    };

    const copy = async () => {
        if (downloads.text === null) return;

        try {
            await navigator.clipboard.writeText(downloads.text);

            toast.success("Transcript copied");
        }
        catch {
            toast.error("Could not copy the transcript");
        }
    };

    const qaStartMs = transcript.data?.qa_start_ms ?? null;

    // A company-published transcript has no audio timings (v2 names no STT provider: its turns carry no start).
    const untimed = view?.kind === "turns" && view.turns.every(turn => turn.start_ms === null);

    return (
        <div className="flex flex-col gap-3">
            <TranscriptToolbar
                canCopy={downloads.text !== null}
                downloads={downloads}
                format={format}
                onCompare={compare ? () => setCompareOpen(true) : null}
                onCopy={() => void copy()}
                onFormatChange={setFormat}
                onVersionChange={version => onSearchChange({ version: version === currentVersion ? undefined : version })}
                qaStartMs={qaStartMs}
                shownVersion={shownVersion}
                versions={versionList}
            />

            {untimed && (
                <div className="text-muted-foreground">Company-published transcript (no audio timings)</div>
            )}

            <TranscriptBody error={transcript.error} format={format} qaStartMs={qaStartMs} speakerImages={speakerImages} view={view} words={words} />

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
                        {compareOpen && <TranscriptDiff eventId={eventId} from={compare.from} to={compare.to} />}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
