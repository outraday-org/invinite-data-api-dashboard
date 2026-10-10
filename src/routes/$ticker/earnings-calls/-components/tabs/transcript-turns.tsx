import * as React from "react";

import type { TranscriptTurn, TranscriptView } from "@/lib/earnings/transcript";

import { qaStartTurnIndex, speakerName } from "@/lib/earnings/transcript";

import { SeekButton } from "../seek-button";

function Turn({ turn }: { turn: TranscriptTurn }) {
    const detail = [turn.title, turn.name ? null : turn.role].filter(Boolean).join(" · ");

    return (
        // `data-start-ms`: "Ask this call" (task 7) scrolls to the turn containing a hit.
        <div className="flex flex-col gap-1" data-start-ms={turn.start_ms ?? undefined}>
            <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{speakerName(turn)}</span>
                {detail && <span className="text-muted-foreground">{detail}</span>}
                <SeekButton startMs={turn.start_ms} />
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">{turn.text}</p>
        </div>
    );
}

/** "Q&A starts at m:ss" — a button that plays from there when the call has a recording. */
export function QaStart({ qaStartMs }: { qaStartMs: null | number }) {
    if (qaStartMs === null) return null;

    return (
        <span className="text-muted-foreground inline-flex items-baseline gap-1 text-xs font-normal">
            Q&A starts at
            <SeekButton startMs={qaStartMs} />
        </span>
    );
}

function Section({ qaStartMs = null, text, title }: { qaStartMs?: null | number; text: null | string; title: string }) {
    if (!text) return null;

    return (
        <section className="flex flex-col gap-2">
            <h3 className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
                {title}
                <QaStart qaStartMs={qaStartMs} />
            </h3>
            <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        </section>
    );
}

/** The header the turns view draws above the first Q&A turn. */
function QaDivider({ qaStartMs }: { qaStartMs: number }) {
    return (
        <div className="flex items-center gap-3 pt-2">
            <h3 className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
                Q&A
                <QaStart qaStartMs={qaStartMs} />
            </h3>
            <div className="bg-border h-px grow" />
        </div>
    );
}

/**
 * The transcript body of one format (`empty` is handled by the tab). `qaStartMs` (the
 * response's `qa_start_ms`) heads the Q&A: on the sections' Q&A block, and as a divider above
 * the first Q&A turn of the speakers / cleaned formats.
 */
export function TranscriptTurns({ qaStartMs, view }: { qaStartMs: null | number; view: TranscriptView }) {
    switch (view.kind) {
        case "empty":
            return null;
        case "sections":
            return (
                <div className="flex flex-col gap-6">
                    <Section text={view.sections.prepared_remarks} title="Prepared remarks" />
                    <Section
                        qaStartMs={view.sections.qa_start_ms ?? qaStartMs}
                        text={view.sections.questions_and_answers}
                        title="Q&A"
                    />
                </div>
            );
        case "text":
            return <pre className="whitespace-pre-wrap break-words font-sans leading-relaxed">{view.text}</pre>;
        case "turns": {
            const qaIndex = qaStartTurnIndex(view.turns, qaStartMs);

            return (
                <div className="flex flex-col gap-4">
                    {view.turns.map((turn, index) => (
                        // Turns have no id; their order within one answer is stable.
                        <React.Fragment key={index}>
                            {index === qaIndex && qaStartMs !== null && <QaDivider qaStartMs={qaStartMs} />}
                            <Turn turn={turn} />
                        </React.Fragment>
                    ))}
                </div>
            );
        }
    }
}
