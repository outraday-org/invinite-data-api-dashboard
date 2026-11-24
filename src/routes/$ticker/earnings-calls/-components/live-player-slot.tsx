import { Link } from "@tanstack/react-router";
import * as React from "react";

import type { V2Event } from "@/lib/api/types";
import type { LiveHighlight } from "@/lib/live/live-highlights";
import type { KeywordWatch } from "@/lib/live/ws-frames";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { isEarningsEventLiveish, useV2PriceAttribution } from "@/lib/api/queries";
import { formatInstant } from "@/lib/format";
import { liveHighlightList, parseKeywords } from "@/lib/live/live-highlights";
import { textBehindEdgeS } from "@/lib/live/live-sync";
import { positionToCallMs } from "@/lib/live/position-to-call-ms";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import type { LiveCall } from "./audio-context";
import type { CallLiveSession } from "./live/use-call-live-session";

import { useLiveCall } from "./audio-context";
import { LiveDot } from "./live-dot";
import { LivePriceChart } from "./live/live-price-chart";
import { formatWallTime } from "./live/live-price-chart-data";
import { Notice } from "./media-state";
import { SeekButton } from "./seek-button";

/** "Watch for keywords": a comma list + exact / stem; applied on submit (a re-subscribe on the open socket). */
function KeywordWatchForm({ onWatch, watch }: { onWatch: (watch: KeywordWatch) => void; watch: KeywordWatch }) {
    const [draft, setDraft] = React.useState(watch.keywords.join(", "));

    const [match, setMatch] = React.useState(watch.match);

    return (
        <form
            aria-label="Watch for keywords"
            className="flex flex-wrap items-center gap-2"
            onSubmit={(submitEvent) => {
                submitEvent.preventDefault();

                onWatch({ keywords: parseKeywords(draft), match });
            }}
        >
            <Input
                aria-label="Keywords to watch"
                className="w-72 max-w-full"
                onChange={changeEvent => setDraft(changeEvent.target.value)}
                placeholder="Watch for keywords, e.g. tariffs, buyback"
                value={draft}
            />
            <DropdownSelect
                aria-label="Keyword match"
                onValueChange={next => setMatch(next)}
                options={[
                    { label: "exact words", value: "exact" },
                    { label: "word forms too (tariff → tariffs)", value: "stem" },
                ]}
                size="sm"
                value={match}
            />
            <Button size="sm" type="submit" variant="outline">Watch</Button>
            {watch.keywords.length > 0 && (
                <span className="text-muted-foreground">
                    Watching
                    {" "}
                    {watch.keywords.join(", ")}
                </span>
            )}
        </form>
    );
}

function HighlightRow({ highlight }: { highlight: LiveHighlight }) {
    if (highlight.kind === "keyword") {
        return (
            <li className="flex flex-wrap items-baseline gap-2" data-highlight="keyword">
                <Badge variant="secondary">{highlight.keyword}</Badge>
                <SeekButton startMs={highlight.layer === "live" ? highlight.startMs : null} />
                <span className="text-muted-foreground">{highlight.speakerName ?? "Unnamed speaker"}</span>
                <span className="min-w-0 truncate">{highlight.text}</span>
            </li>
        );
    }

    return (
        <li className="flex flex-wrap items-baseline gap-2" data-highlight="guidance" title={highlight.sourceSentence}>
            <Badge variant="outline">guidance</Badge>
            <SeekButton startMs={highlight.startMs} />
            <span className="font-medium">
                {highlight.metric}
                {" · "}
                {highlight.periodLabel}
            </span>
            <span className="tabular-nums">{highlight.value}</span>
            {highlight.revision > 1 && <span className="text-muted-foreground">(restated)</span>}
        </li>
    );
}

/** Keyword hits and guidance flashes in call order, each with a ▷ timestamp (a final-layer hit is on another clock). */
function LiveHighlights({ live }: { live: LiveCall }) {
    const highlights = liveHighlightList(live.transcript.highlights);

    return (
        <Section aria-label="Live highlights" className="gap-2" title="Live highlights">
            <KeywordWatchForm onWatch={live.setWatch} watch={live.watch} />
            {highlights.length === 0
                ? <p className="text-muted-foreground">No keyword hits or guidance yet.</p>
                : <ul className="flex flex-col gap-1">{highlights.map(highlight => <HighlightRow highlight={highlight} key={`${highlight.kind}-${highlight.key}`} />)}</ul>}
        </Section>
    );
}

function Diagnostics({ live, priceRows }: { live: LiveCall; priceRows: number }) {
    const { audio, callT0, mode, newestFinal, stream, streamStatus, transcript } = live;

    const textBehindEdge = textBehindEdgeS(positionToCallMs(audio.position.edgeDate, callT0), newestFinal?.endMs ?? null);

    const lastTick = transcript.prices.last;

    return (
        <details className="text-xs">
            <summary className="text-muted-foreground cursor-pointer">Diagnostics</summary>
            <dl className="text-muted-foreground mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
                <dt>Stream</dt>
                <dd>{streamStatus}</dd>
                <dt>Stream URL expires</dt>
                <dd>{audio.loadedExpiresAt ?? stream?.expires_at ?? "—"}</dd>
                <dt>Call t0</dt>
                <dd>{callT0 ?? "—"}</dd>
                <dt>Credits</dt>
                <dd>5 per stream request: asked once per live view and once more on a 403 (an expired token)</dd>
                <dt>Audio</dt>
                <dd>{audio.phase}</dd>
                <dt>Audio behind edge</dt>
                <dd>
                    {audio.position.edgeBehindS.toFixed(1)}
                    {" s"}
                </dd>
                <dt>Text behind edge</dt>
                <dd>{textBehindEdge === null ? "unknown" : `${textBehindEdge.toFixed(1)} s`}</dd>
                <dt>Playback mode</dt>
                <dd>{mode === "synced" ? "synced to the transcript" : "live audio"}</dd>
                <dt>hls.js errors</dt>
                <dd>
                    {audio.hlsErrorCount}
                    {audio.lastHlsError && ` · last ${audio.lastHlsError.type} / ${audio.lastHlsError.details}`}
                </dd>
                <dt>WebSocket</dt>
                <dd>
                    {transcript.mode}
                    {transcript.reconnecting ? " · reconnecting" : ""}
                    {transcript.stalled ? " · stalled" : ""}
                </dd>
                <dt>Last contiguous seq</dt>
                <dd>{transcript.state.lastSeq}</dd>
                <dt>Pending gap</dt>
                <dd>{transcript.state.gapRefetch === null ? "none" : `after seq ${transcript.state.gapRefetch.afterSeq}`}</dd>
                <dt>Price ticks</dt>
                <dd>
                    {transcript.prices.ticks.length}
                    {lastTick !== null && ` (last at ${formatWallTime(Date.parse(lastTick.at))} ET, ${lastTick.source})`}
                </dd>
                <dt>Minute rows</dt>
                <dd>{priceRows}</dd>
                <dt>Malformed frames</dt>
                <dd>{transcript.malformedFrames}</dd>
            </dl>
        </details>
    );
}

/** The live call's extras above the tabs; the audio controls are the player's, the transcript the Transcript tab's. */
function LiveCallCard({ event, live }: { event: V2Event; live: LiveCall }) {
    const { audio, callEnded, callT0, transcript } = live;

    // The price line's backlog: the live minute rows (a 404 = none yet). Settled rows of the post-call run use another
    // reference, so only live rows seed the line.
    const minuteRows = useV2PriceAttribution(event.event_id, { live: isEarningsEventLiveish(event) }).data;

    const priceSeed = minuteRows?.live ? minuteRows.buckets : [];

    const { prices } = transcript;

    const callMs = positionToCallMs(audio.position.playingDate, callT0);

    const priceCursorMs = audio.started && audio.phase !== "ended" ? callMs : null;

    return (
        <Card size="sm">
            <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                    <LiveDot />
                    <CardTitle className="text-sm">{callEnded ? "Live call (ended)" : "Live call"}</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {transcript.rescheduledTo !== null && (
                    <p className="text-sm" role="status">
                        This call was rescheduled to
                        {" "}
                        {formatInstant(transcript.rescheduledTo)}
                        .
                        {" "}
                        <Link className="text-primary underline-offset-4 hover:underline" params={{ ticker: event.symbol }} to="/$ticker/earnings-calls">
                            All calls of
                            {" "}
                            {event.symbol}
                        </Link>
                    </p>
                )}

                {callEnded && transcript.rescheduledTo === null && (
                    <p className="bg-muted rounded-md p-3 text-sm" role="status">
                        {event.has_transcript
                            ? "Call ended — the final transcript is in the Transcript tab."
                            : "Call ended — final transcript in progress; the live one stays in the Transcript tab."}
                    </p>
                )}

                <LiveHighlights live={live} />

                <Section aria-label="Live price" className="gap-2" title="Price">
                    {prices.ticks.length > 0 || priceSeed.length > 0
                        ? <LivePriceChart buckets={priceSeed} callT0={callT0} cursorMs={priceCursorMs} prices={prices} />
                        : <p className="text-muted-foreground">No price ticks yet.</p>}
                </Section>

                <Diagnostics live={live} priceRows={priceSeed.length} />
            </CardContent>
        </Card>
    );
}

/**
 * The live call's place on the call page, above the tabs (O4: notices, "Live highlights", the price chart and the
 * diagnostics; the audio controls moved into the player bar, the transcript into the Transcript tab). Shown while the
 * page follows the call live (`useCallLiveSession`: capturing or in `/v1/events?status=live`; sticky for the page's
 * life, so the ended note stays). No stored key → "Enter your API key to follow this call live".
 */
export function LivePlayerSlot({ event, session }: { event: V2Event; session: CallLiveSession }) {
    const live = useLiveCall();

    const apiKey = useApiKeyStore(s => s.apiKey);

    const hasHydrated = useApiKeyStore(s => s.hasHydrated);

    if (!session.sawLive || !hasHydrated) return null;

    if (apiKey === null) {
        return (
            <Notice badge="Live" title="Enter your API key to follow this call live">
                The live transcript opens a WebSocket from this browser with the API key stored on the landing page.
            </Notice>
        );
    }

    return live === null ? null : <LiveCallCard event={event} live={live} />;
}
