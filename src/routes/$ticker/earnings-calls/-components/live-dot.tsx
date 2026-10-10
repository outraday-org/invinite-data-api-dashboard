import { cn } from "@/lib/utils";

/** The pulsing red dot of a call in progress ("Live now", the Live badge, the live player). */
export function LiveDot({ className }: { className?: string }) {
    return <span aria-hidden className={cn("size-2 rounded-full bg-destructive animate-pulse", className)} />;
}
