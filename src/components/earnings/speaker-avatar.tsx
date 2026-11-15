import * as React from "react";

import { initialsOf } from "@/lib/earnings/initials";
import { cn } from "@/lib/utils";

const SIZES = {
    md: "size-8 text-[11px]",
    sm: "size-6 text-[10px]",
} as const;

/**
 * A speaker's round image, the rule of the transcript PDF (backend speaker images task 6, D11): the participation's
 * `image_url` (photo or logo, cover-cropped round), else an initials disc; no name (or the operator) = nothing at all,
 * no reserved space. An image that fails to load falls back to the initials. The URL is permanent and public.
 */
export function SpeakerAvatar({
    className,
    imageUrl,
    name,
    size = "sm",
    speakerRole,
}: {
    className?: string;
    imageUrl: null | string | undefined;
    name: null | string | undefined;
    speakerRole?: null | string;
    size?: keyof typeof SIZES;
}) {
    const [failedUrl, setFailedUrl] = React.useState<null | string>(null);

    if (!name || speakerRole === "operator") return null;

    const initials = initialsOf(name);

    const base = cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", SIZES[size], className);

    if (imageUrl && failedUrl !== imageUrl) {
        return (
            <img
                alt=""
                className={cn(base, "bg-muted object-cover")}
                decoding="async"
                loading="lazy"
                onError={() => setFailedUrl(imageUrl)}
                referrerPolicy="no-referrer"
                src={imageUrl}
            />
        );
    }

    if (initials === null) return null;

    return (
        <span aria-hidden className={cn(base, "bg-emerald-100 font-bold tracking-wide text-foreground dark:bg-emerald-950")}>
            {initials}
        </span>
    );
}
