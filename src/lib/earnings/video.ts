import type { V2EventVideo } from "@/lib/api/types";

/** The platforms the API finds broadcasts on (v2's `video` names none: read from the URLs, `videoProvider`). */
export type VideoProvider = "vimeo" | "youtube";

export const VIDEO_PROVIDER_LABELS: Record<VideoProvider, string> = {
    vimeo: "Vimeo",
    youtube: "YouTube",
};

// The only hosts the page frames: the privacy-enhanced players the API serves as `embed_url`
// (YouTube `youtube-nocookie.com`, Vimeo `player.vimeo.com?dnt=1`). Anything else is linked, never framed.
const EMBED_HOSTS: Record<VideoProvider, string> = {
    vimeo: "player.vimeo.com",
    youtube: "www.youtube-nocookie.com",
};

const PROVIDER_HOSTS: ReadonlyArray<[VideoProvider, RegExp]> = [
    ["youtube", /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/],
    ["vimeo", /(^|\.)vimeo\.com$/],
];

/** `value` as an https URL; null for anything else (an API string never becomes a `javascript:` href). */
export function httpsUrl(value: null | string): null | URL {
    if (!value) return null;

    try {
        const url = new URL(value);

        return url.protocol === "https:" ? url : null;
    }
    catch {
        return null;
    }
}

/**
 * The platform of a video, from its `embed_url` / `url` host (`Event.video` has no `provider` in v2); null = another
 * host (then never framed, only linked).
 */
export function videoProvider(video: Pick<V2EventVideo, "embed_url" | "url">): null | VideoProvider {
    for (const value of [video.embed_url, video.url]) {
        const host = httpsUrl(value)?.hostname;

        const match = host ? PROVIDER_HOSTS.find(([, pattern]) => pattern.test(host)) : undefined;

        if (match) return match[0];
    }

    return null;
}

/** "YouTube" / "Vimeo", else "video platform". */
export function videoProviderLabel(video: Pick<V2EventVideo, "embed_url" | "url">) {
    const provider = videoProvider(video);

    return provider ? VIDEO_PROVIDER_LABELS[provider] : "video platform";
}

/**
 * The iframe src of an embeddable video (`embeddable` true or null = not checked yet): `embed_url`
 * with `autoplay=1` (the click on the facade is the play) and, for Vimeo, `dnt=1`, only on the provider's
 * privacy-enhanced player host. Null = link the watch page instead.
 */
export function videoEmbedSrc(video: V2EventVideo): null | string {
    if (video.embeddable === false) return null;

    const url = httpsUrl(video.embed_url);

    const provider = videoProvider(video);

    if (!url || provider === null || url.hostname !== EMBED_HOSTS[provider]) return null;

    url.searchParams.set("autoplay", "1");

    // Vimeo tracks unless told not to: enforced here, never trusted to the API's URL.
    if (provider === "vimeo") url.searchParams.set("dnt", "1");

    return url.toString();
}
