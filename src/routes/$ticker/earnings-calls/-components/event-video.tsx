import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ExternalLink, Play, Video } from "lucide-react";
import * as React from "react";

import type { EarningsEvent, EarningsEventVideo } from "@/lib/api/types";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { httpsUrl, VIDEO_PROVIDER_LABELS, videoEmbedSrc } from "@/lib/earnings/video";

function ChannelNote({ video }: { video: EarningsEventVideo }) {
    return (
        <span className="text-muted-foreground text-[0.625rem]">
            Played from the company&apos;s
            {" "}
            {VIDEO_PROVIDER_LABELS[video.provider]}
            {" "}
            channel
            {video.channel ? ` (${video.channel})` : ""}
            .
        </span>
    );
}

/**
 * The event's public broadcast (`video`). Embeddable (`embeddable` not false): a click-to-load
 * facade — a neutral placeholder (never `thumbnail_url`: no request to the platform before the
 * click, GDPR), the title, provider and a play button; the privacy-enhanced player iframe
 * (`youtube-nocookie.com` / Vimeo `dnt=1`) is created only by the click. Not embeddable: a link to the watch page. `null`: nothing.
 */
export function EventVideo({ onPlay, video }: { onPlay?: () => void; video: EarningsEventVideo | null }) {
    const [playing, setPlaying] = React.useState(false);

    if (!video) return null;

    const provider = VIDEO_PROVIDER_LABELS[video.provider];

    const title = video.title ?? `${provider} video`;

    const src = videoEmbedSrc(video);

    if (src === null) {
        const watchUrl = httpsUrl(video.url);

        if (!watchUrl) return null;

        return (
            <div className="flex flex-col gap-1">
                <a
                    className="inline-flex w-fit items-center gap-1 text-xs underline underline-offset-4"
                    href={watchUrl.toString()}
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    <ExternalLink className="size-3.5" />
                    Watch on
                    {" "}
                    {provider}
                    {video.title ? `: ${video.title}` : ""}
                </a>
                <ChannelNote video={video} />
            </div>
        );
    }

    return (
        <div className="flex w-full max-w-xl flex-col gap-1">
            <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted/30">
                {playing
                    ? (
                            <iframe
                                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                                allowFullScreen
                                className="absolute inset-0 size-full"
                                loading="lazy"
                                // YouTube's player refuses an embed without a referrer (error 153).
                                referrerPolicy="strict-origin-when-cross-origin"
                                src={src}
                                title={title}
                            />
                        )
                    : (
                            <button
                                aria-label={`Play video: ${title}`}
                                className="group absolute inset-0 flex size-full items-center justify-center"
                                onClick={() => {
                                    setPlaying(true);

                                    onPlay?.();
                                }}
                                type="button"
                            >
                                <Video className="absolute size-10 text-muted-foreground" />
                                <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-left text-xs text-white">
                                    {title}
                                    <span className="text-white/70">
                                        {" · "}
                                        {provider}
                                    </span>
                                </span>
                                <span className="relative flex size-12 items-center justify-center rounded-full bg-black/70 text-white group-hover:bg-black/85">
                                    <Play className="size-5 fill-current" />
                                </span>
                            </button>
                        )}
            </div>
            <ChannelNote video={video} />
        </div>
    );
}

/**
 * The video's place on the call page, above the tabs. During a live capture the live player
 * stays primary and the video waits under "Watch the broadcast"; before and after the call it
 * is shown. The disclosure button is the only conditional sibling, so a playing video keeps its
 * iframe when the capture ends; a video the user started stays mounted when a capture starts
 * (the 30-s refetch would otherwise tear the player down mid-play).
 */
export function EventVideoSlot({ event }: { event: Pick<EarningsEvent, "capture_status" | "video"> }) {
    const [open, setOpen] = React.useState(false);

    const [started, setStarted] = React.useState(false);

    if (!event.video) return null;

    const live = event.capture_status === "capturing";

    const DisclosureIcon = open ? ChevronDown : ChevronRight;

    return (
        <div className="flex flex-col gap-2">
            {live && (
                <button
                    aria-expanded={open}
                    className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-xs"
                    onClick={() => setOpen(previous => !previous)}
                    type="button"
                >
                    <DisclosureIcon className="size-3.5" />
                    Watch the broadcast
                </button>
            )}
            {(!live || open || started) && <EventVideo onPlay={() => setStarted(true)} video={event.video} />}
        </div>
    );
}

/** Calendar icon: the event has a video (→ its call page, where it plays). */
export function EventVideoLink({ event }: { event: Pick<EarningsEvent, "event_id" | "symbol" | "video"> }) {
    if (!event.video) return null;

    return (
        <Tooltip>
            <TooltipTrigger
                render={(
                    <Link
                        aria-label="Watch the video on the call page"
                        params={{ eventId: event.event_id, ticker: event.symbol }}
                        to="/$ticker/earnings-calls/$eventId"
                    />
                )}
            >
                <Video className="size-3.5 text-muted-foreground hover:text-foreground" />
            </TooltipTrigger>
            <TooltipContent>
                Video on
                {" "}
                {VIDEO_PROVIDER_LABELS[event.video.provider]}
            </TooltipContent>
        </Tooltip>
    );
}
