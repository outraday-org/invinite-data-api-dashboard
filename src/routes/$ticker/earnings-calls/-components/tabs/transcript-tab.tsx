import * as React from "react";
import { toast } from "sonner";

import type { TimedWord } from "@/lib/earnings/follow-along";
import type { TranscriptView } from "@/lib/earnings/transcript";

import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError } from "@/lib/api/errors";
import { useV2Participants, useV2Transcript, useV2TranscriptVersions } from "@/lib/api/queries";
import { callFileStem } from "@/lib/download";
import { timedWordsOfTurns, toWordTurns } from "@/lib/earnings/follow-along";
import { scrollToTurn } from "@/lib/earnings/scroll-to-turn";
import { toTranscriptView, transcriptPlainText } from "@/lib/earnings/transcript";
import { READING_COLUMN_CLASS } from "@/lib/layout";

import type { CallTabProps } from "../call-tabs";
import type { TranscriptDownloads } from "../transcript/transcript-toolbar";
import type { SpeakerImages } from "./transcript-turns";

import { useCallAudio } from "../audio-context";
import { MediaState, Notice } from "../media-state";
import { recordingFilename } from "../player/recording-player";
import { TranscriptToolbar } from "../transcript/transcript-toolbar";
import { TranscriptTurns, useSpeakerImages } from "./transcript-turns";

function TranscriptBody({
    error,
    qaStartMs,
    speakerImages,
    view,
    words,
}: {
    error: Error | null;
    qaStartMs: null | number;
    speakerImages: SpeakerImages;
    view: null | TranscriptView;
    words: null | ReadonlyArray<Array<TimedWord> | null>;
}) {
    if (error) {
        return (
            <MediaState
                error={error}
                notFound="Transcript is being prepared"
                operationId="getTranscript"
                title="Failed to load the transcript"
            />
        );
    }

    if (!view) return <Skeleton className="h-40 w-full" />;

    if (view.kind === "empty") return <Notice title="Transcript is being prepared" />;

    return <TranscriptTurns qaStartMs={qaStartMs} speakerImages={speakerImages} view={view} words={words} />;
}

/** The current cleaned transcript, with its speakers and Q&A boundary; raw turns remain available while cleaning is pending. */
export function TranscriptTab({ event, eventId, onTranscriptJumpHandled, transcriptJump }: CallTabProps) {
    const versions = useV2TranscriptVersions(eventId);

    const cleaned = useV2Transcript({ eventId, layer: "cleaned" });

    // A missing cleaned layer must not hide an available transcript. Other API refusals remain visible.
    const useRaw = cleaned.error instanceof ApiRequestError && cleaned.error.status === 404 && cleaned.error.code === "not_found";

    const raw = useV2Transcript({ eventId: useRaw ? eventId : "", words: true });

    const transcript = useRaw ? raw : cleaned;

    const participants = useV2Participants(eventId);

    const speakerImages = useSpeakerImages(participants.data);

    const view = React.useMemo(() => transcript.data ? toTranscriptView("cleaned", transcript.data.turns) : null, [transcript.data]);

    // The cleaned layer has no word timings; preserve turn-level playback without inventing word timings.
    const words = React.useMemo(
        () => (useRaw && raw.data ? timedWordsOfTurns(toWordTurns(raw.data.turns)) : null),
        [raw.data, useRaw],
    );

    const shown = transcript.data ?? undefined;

    React.useEffect(() => {
        if (!transcriptJump) return;

        // Shared timestamp links locate the passage quietly; explicit passage jumps report a missing timing.
        const { fromLink } = transcriptJump;

        const notify = (message: string) => {
            if (!fromLink) toast.info(message);
        };

        if (transcript.error) {
            notify("The transcript could not be loaded to locate this passage");

            onTranscriptJumpHandled();

            return;
        }

        if (!shown || !view) return;

        if (view.kind !== "turns") {
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
    }, [onTranscriptJumpHandled, shown, transcript.error, transcriptJump, view]);

    const shownVersion = transcript.data?.version ?? null;

    const listedEntry = versions.data?.data.find(version => version.version === shownVersion);

    const shownEntry = shown ? { ...shown, corrected_by: listedEntry?.corrected_by ?? null } : undefined;

    const { recording } = useCallAudio();

    const downloads: TranscriptDownloads = {
        audio: event.has_audio ? { download: recording ? { filename: recordingFilename(event, recording), url: recording.url } : null } : null,
        baseName: callFileStem(event, shownVersion === null ? "transcript" : `transcript-v${shownVersion}`),
        json: shown ?? null,
        pdf: shown?.pdf ?? null,
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
                onCopy={() => void copy()}
                qaStartMs={qaStartMs}
                shownEntry={shownEntry}
            />

            {untimed && (
                <div className="text-muted-foreground">Company-published transcript (no audio timings)</div>
            )}

            {/* The reading column: ≈ 72 characters a line in the transcript (ui-redesign task 10). */}
            <div className={READING_COLUMN_CLASS}>
                <TranscriptBody error={transcript.error} qaStartMs={qaStartMs} speakerImages={speakerImages} view={view} words={words} />
            </div>
        </div>
    );
}
