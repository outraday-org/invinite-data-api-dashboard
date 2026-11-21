import { Download, Loader2, LocateFixed, MoreHorizontal, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import * as React from "react";

import type { PlayerEngine } from "@/lib/player/engine";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { savePublicFile } from "@/lib/news/download";
import { PLAYER_RATES, PLAYER_SKIP_SECONDS, writeStoredRate } from "@/lib/player/engine";

/** One row of the `⋯` menu (file facts; O4 adds the live sync mode). */
export type PlayerDetail = { label: string; value: string };

/** The file `CallPlayer`'s download button saves: the permanent public URL under a readable name. */
export type PlayerDownload = { filename: string; url: string };

export function PlayPauseButton({ engine }: { engine: PlayerEngine }) {
    const playing = !engine.paused;

    return (
        <Button
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => (playing ? engine.pause() : engine.play())}
            size="icon"
            type="button"
            variant="default"
        >
            {engine.buffering ? <Loader2 className="animate-spin" /> : playing ? <Pause /> : <Play />}
        </Button>
    );
}

export function SkipButtons({ engine }: { engine: PlayerEngine }) {
    return (
        <div className="flex items-center">
            <Button aria-label={`Back ${PLAYER_SKIP_SECONDS} seconds`} onClick={() => engine.skip(-PLAYER_SKIP_SECONDS)} size="icon-sm" type="button" variant="ghost">
                <RotateCcw />
            </Button>
            <Button aria-label={`Forward ${PLAYER_SKIP_SECONDS} seconds`} onClick={() => engine.skip(PLAYER_SKIP_SECONDS)} size="icon-sm" type="button" variant="ghost">
                <RotateCw />
            </Button>
        </div>
    );
}

/** 1× / 1.5× / 2×; compact: one button that steps through them. The choice is remembered per browser. */
export function SpeedButtons({ compact, engine }: { compact: boolean; engine: PlayerEngine }) {
    const choose = (rate: number) => {
        engine.setRate(rate);

        writeStoredRate(rate);
    };

    if (compact) {
        const index = PLAYER_RATES.findIndex(rate => rate === engine.rate);

        const next = PLAYER_RATES[(index + 1) % PLAYER_RATES.length];

        return (
            <Button aria-label={`Speed ${engine.rate}×, change to ${next}×`} onClick={() => choose(next)} size="sm" type="button" variant="ghost">
                {engine.rate}
                ×
            </Button>
        );
    }

    return (
        <div aria-label="Speed" className="flex items-center" role="group">
            {PLAYER_RATES.map(rate => (
                <Button
                    aria-pressed={engine.rate === rate}
                    key={rate}
                    onClick={() => choose(rate)}
                    size="sm"
                    type="button"
                    variant={engine.rate === rate ? "secondary" : "ghost"}
                >
                    {rate}
                    ×
                </Button>
            ))}
        </div>
    );
}

/** Mute toggle + level (the level hides in the compact bar and on narrow screens). */
export function VolumeControl({ compact, engine }: { compact: boolean; engine: PlayerEngine }) {
    const silent = engine.muted || engine.volume === 0;

    return (
        <div className="flex items-center gap-1">
            <Button
                aria-label={silent ? "Unmute" : "Mute"}
                aria-pressed={silent}
                onClick={() => engine.setVolume(engine.volume === 0 ? 1 : engine.volume, !silent)}
                size="icon-sm"
                type="button"
                variant="ghost"
            >
                {silent ? <VolumeX /> : <Volume2 />}
            </Button>
            {!compact && (
                <input
                    aria-label="Volume"
                    className="accent-primary hidden h-1 w-16 cursor-pointer sm:block"
                    max={1}
                    min={0}
                    onChange={(event) => {
                        const volume = Number(event.currentTarget.value);

                        engine.setVolume(volume, volume === 0);
                    }}
                    step={0.05}
                    type="range"
                    value={engine.muted ? 0 : engine.volume}
                />
            )}
        </div>
    );
}

/** The transcript follows the audio (on by default); the reader's scroll switches it off, this resumes it. */
export function FollowButton({ follow, onFollowChange }: { follow: boolean; onFollowChange: (on: boolean) => void }) {
    return (
        <Button
            aria-pressed={follow}
            onClick={() => onFollowChange(!follow)}
            size="sm"
            title={follow ? "The transcript follows the audio" : "Follow the audio in the transcript"}
            type="button"
            variant={follow ? "secondary" : "ghost"}
        >
            <LocateFixed />
            Follow
        </Button>
    );
}

/**
 * Saves the recording (`savePublicFile`: the `download` attribute is ignored across origins, so the bytes are fetched
 * to a blob; storage refusing CORS for this origin opens the file in a new tab instead). Never proxied.
 */
export function DownloadButton({ download }: { download: PlayerDownload }) {
    const [saving, setSaving] = React.useState(false);

    return (
        <Button
            aria-label="Download the recording"
            disabled={saving}
            onClick={() => {
                setSaving(true);

                void savePublicFile(download.url, download.filename).finally(() => setSaving(false));
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
        >
            {saving ? <Loader2 className="animate-spin" /> : <Download />}
        </Button>
    );
}

export function MoreMenu({ details, title }: { details: ReadonlyArray<PlayerDetail>; title: string }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button aria-label="Player details" size="icon-sm" type="button" variant="ghost" />}>
                <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{title}</DropdownMenuLabel>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-2 pb-2 text-xs">
                        {details.map(detail => (
                            <React.Fragment key={detail.label}>
                                <dt className="text-muted-foreground">{detail.label}</dt>
                                <dd className="text-right tabular-nums">{detail.value}</dd>
                            </React.Fragment>
                        ))}
                    </dl>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
