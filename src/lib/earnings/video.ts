import type { EarningsEventVideo } from "@/lib/api/types";

export const VIDEO_PROVIDER_LABELS: Record<EarningsEventVideo["provider"], string> = {
    vimeo: "Vimeo",
    youtube: "YouTube",
};

// The only hosts the page frames: the privacy-enhanced players the API serves as `embed_url`
// (YouTube `youtube-nocookie.com`, Vimeo `player.vimeo.com?dnt=1`). Anything else is linked, never framed.
const EMBED_HOSTS: Record<EarningsEventVideo["provider"], string> = {
    vimeo: "player.vimeo.com",
    youtube: "www.youtube-nocookie.com",
};

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
 * The iframe src of an embeddable video (`embeddable` true or null = not checked yet): `embed_url`
 * with `autoplay=1` (the click on the facade is the play), only on the provider's privacy-enhanced
 * player host. Null = link the watch page instead.
 */
export function videoEmbedSrc(video: EarningsEventVideo): null | string {
    if (video.embeddable === false) return null;

    const url = httpsUrl(video.embed_url);

    if (!url || url.hostname !== EMBED_HOSTS[video.provider]) return null;

    url.searchParams.set("autoplay", "1");

    return url.toString();
}
