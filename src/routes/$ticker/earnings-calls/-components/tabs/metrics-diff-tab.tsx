import type * as React from "react";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import type { EarningsDiffResponse, EarningsMetricsResponse } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEarningsDiff, useEarningsMetrics } from "@/lib/api/queries";
import { formatMs } from "@/lib/earnings/format";
import { formatDecimal, formatSigned, percent, TONE_SHIFT_LABELS } from "@/lib/earnings/labels";

import type { CallTabProps } from "../call-tabs";

import { EventLink } from "../event-link";
import { MediaState, Notice } from "../media-state";
import { SeekButton } from "../seek-button";

type Metrics = EarningsMetricsResponse;

const yesNo = (value: boolean | null) => (value === null ? "—" : value ? "Yes" : "No");

const durationOrDash = (ms: null | number) => (ms === null ? "—" : formatMs(ms));

/** "1 h 5 min" / "12 min" / "45 s" of a gap in seconds (can be large: release the day before). */
function formatGapSeconds(seconds: null | number) {
    if (seconds === null) return "—";

    const sign = seconds < 0 ? "−" : "";

    const abs = Math.abs(seconds);

    if (abs < 60) return `${sign}${abs} s`;

    const minutes = Math.round(abs / 60);

    if (minutes < 60) return `${sign}${minutes} min`;

    const hours = Math.floor(minutes / 60);

    return `${sign}${hours} h ${minutes % 60} min`;
}

const METRIC_ROWS: Array<{ label: string; value: (metrics: Metrics) => string }> = [
    { label: "Call happened", value: m => yesNo(m.call_happened) },
    { label: "Call length", value: m => durationOrDash(m.call_length_ms) },
    { label: "Press release → call", value: m => formatGapSeconds(m.release_to_call_gap_s) },
    { label: "Prepared remarks", value: m => durationOrDash(m.prepared_remarks_ms) },
    { label: "Q&A", value: m => durationOrDash(m.qa_ms) },
    { label: "Q&A share of the call", value: m => percent(m.qa_share) },
    { label: "Questions", value: m => String(m.question_count) },
    { label: "Analysts", value: m => String(m.analyst_count) },
    { label: "Management's word share in Q&A", value: m => percent(m.mgmt_word_share_qa) },
    { label: "No questions taken", value: m => yesNo(m.zero_questions) },
    { label: "Prepared remarks posted in advance", value: m => yesNo(m.prepared_remarks_posted_in_advance) },
    { label: "Speakers", value: m => String(m.speaker_count) },
    { label: "Unattributed words", value: m => percent(m.unknown_speaker_word_share) },
];

function Section({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{title}</h3>
            {children}
        </section>
    );
}

function MetricsSection({ selector }: Pick<CallTabProps, "selector">) {
    const { data, error, isLoading } = useEarningsMetrics(selector);

    if (error) {
        return <MediaState error={error} notFound="Call metrics are not derived yet" title="Failed to load call metrics" />;
    }

    if (isLoading || !data) return <Skeleton className="h-48 w-full" />;

    return (
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1.5 sm:max-w-lg">
            {METRIC_ROWS.map(row => (
                <div className="contents" key={row.label}>
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="text-right tabular-nums">{row.value(data)}</dd>
                </div>
            ))}
        </dl>
    );
}

/** `similarity` (0–1) as a gauge bar. */
function SimilarityGauge({ value }: { value: null | number }) {
    if (value === null) return <span className="text-muted-foreground">not available</span>;

    const width = Math.round(Math.min(1, Math.max(0, value)) * 100);

    return (
        <div className="flex items-center gap-2">
            <div className="bg-muted h-2 w-40 overflow-hidden rounded-full">
                <div className="bg-primary h-full" style={{ width: `${width}%` }} />
            </div>
            <span className="tabular-nums">{formatDecimal(value, 2)}</span>
        </div>
    );
}

function ChangeArrow({ change }: { change: null | number }) {
    if (change === null) return null;

    const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;

    return (
        <span className="text-muted-foreground inline-flex items-center gap-0.5 tabular-nums">
            <Icon className="size-3" />
            {formatSigned(change, 3)}
        </span>
    );
}

/** A lexicon level and its change vs the prior call; the lexicon may be licence-gated (null). */
function LevelRow({ hint, label, value }: { hint?: string; label: string; value: EarningsDiffResponse["hedging"] }) {
    return (
        <div className="contents">
            <dt className="text-muted-foreground">
                {label}
                {hint && <span className="text-muted-foreground/70">{` (${hint})`}</span>}
            </dt>
            <dd className="flex items-center gap-3">
                {value.level === null
                    ? <span className="text-muted-foreground">not available</span>
                    : <span className="tabular-nums">{formatDecimal(value.level, 3)}</span>}
                <ChangeArrow change={value.change} />
            </dd>
        </div>
    );
}

function TopicList({ title, topics }: { title: string; topics: EarningsDiffResponse["new_topics"] }) {
    return (
        <section className="flex flex-col gap-2">
            <h4 className="font-medium">{title}</h4>
            {topics === null
                ? <div className="text-muted-foreground">not available</div>
                : topics.length === 0
                    ? <div className="text-muted-foreground">None.</div>
                    : (
                            <ul className="flex flex-col gap-2">
                                {topics.map(topic => (
                                    <li className="flex flex-col gap-0.5" key={topic.topic}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">{topic.topic}</span>
                                            <SeekButton startMs={topic.start_ms} />
                                        </div>
                                        <p className="text-muted-foreground italic leading-relaxed">{`“${topic.evidence}”`}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
        </section>
    );
}

function TitleList({ label, titles }: { label: string; titles: Array<string> }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">{label}</span>
            {titles.length === 0
                ? <span className="text-muted-foreground">—</span>
                : <ul className="list-disc pl-4">{titles.map(title => <li key={title}>{title}</li>)}</ul>}
        </div>
    );
}

function SlideDiff({ diff }: { diff: EarningsDiffResponse["slide_diff"] }) {
    if (!diff) return <div className="text-muted-foreground">No slide decks to compare.</div>;

    return (
        <div className="flex flex-col gap-2">
            <div className="tabular-nums">
                {`${diff.current_pages} pages vs ${diff.prior_pages} (${formatSigned(diff.page_delta, 0)}) · ${diff.shared_titles} shared titles`}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <TitleList label="New slide titles" titles={diff.new_titles} />
                <TitleList label="Dropped slide titles" titles={diff.dropped_titles} />
            </div>
        </div>
    );
}

function DiffSection({ event, selector }: Pick<CallTabProps, "event" | "selector">) {
    const { data, error, isLoading } = useEarningsDiff(selector);

    if (error) {
        return (
            <MediaState
                error={error}
                notFound="No comparison yet — the first call on record, or not derived yet"
                title="Failed to load the comparison with the prior call"
            />
        );
    }

    if (isLoading || !data) return <Skeleton className="h-48 w-full" />;

    if (!data.prior_event) return <Notice title="First call on record — nothing to compare" />;

    return (
        <div className="flex flex-col gap-4">
            <div>
                Compared with
                {" "}
                <EventLink className="font-medium underline-offset-4 hover:underline" event={{ event_id: data.prior_event.event_id, symbol: event.symbol }}>
                    {data.prior_event.conference_date}
                </EventLink>
            </div>

            <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-6 gap-y-2">
                <dt className="text-muted-foreground">Similarity</dt>
                <dd><SimilarityGauge value={data.similarity} /></dd>
                <dt className="text-muted-foreground">Tone shift</dt>
                <dd>
                    {data.tone_shift
                        ? <Badge variant={data.tone_shift === "more_cautious" ? "destructive" : "secondary"}>{TONE_SHIFT_LABELS[data.tone_shift]}</Badge>
                        : <span className="text-muted-foreground">not available</span>}
                </dd>
                <LevelRow label="Hedging" value={data.hedging} />
                <LevelRow label="Uncertainty" value={data.uncertainty} />
                <LevelRow hint="numbers per 100 tokens" label="Numeric specificity" value={data.numeric_specificity} />
            </dl>
            {/* The API's caveat: levels are the better-supported signal, the change a weaker one. */}
            <p className="text-muted-foreground">Levels are the better-supported signal; the change from the prior call is weaker — do not over-weight it.</p>

            {data.summary && <p className="leading-relaxed">{data.summary}</p>}

            <div className="grid gap-4 md:grid-cols-2">
                <TopicList title="New topics" topics={data.new_topics} />
                <TopicList title="Dropped topics" topics={data.dropped_topics} />
            </div>

            <Section title="Slides">
                <SlideDiff diff={data.slide_diff} />
            </Section>
        </div>
    );
}

/** Metrics & diff tab: call metadata, then how the call differs from the company's prior call. */
export function MetricsDiffTab({ event, selector }: CallTabProps) {
    return (
        <div className="flex flex-col gap-6">
            <Section title="Call metrics">
                <MetricsSection selector={selector} />
            </Section>
            <Section title="Versus the prior call">
                <DiffSection event={event} selector={selector} />
            </Section>
        </div>
    );
}
