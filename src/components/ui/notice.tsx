import type * as React from "react";

import { CircleAlert, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge } from "./badge";

export type StateTone = "destructive" | "neutral" | "warn";

const TONE_CLASSES: Record<StateTone, { bar: string; icon: string }> = {
    destructive: { bar: "border-l-destructive", icon: "text-destructive" },
    neutral: { bar: "border-l-border", icon: "text-muted-foreground" },
    warn: { bar: "border-l-warn", icon: "text-warn" },
};

const TONE_ICONS: Record<StateTone, typeof Info> = { destructive: CircleAlert, neutral: Info, warn: TriangleAlert };

/**
 * The one layout of every state block (ui-redesign task 6; `Notice`, `ErrorState` and through them
 * `RequestErrorState` / `SecReadinessNotice`): an icon, a 14 px title with an optional badge, 13 px text, an optional
 * action; at most 60 characters wide; a left accent bar instead of a box (neutral, `--warn`, `--destructive`).
 */
export function StateBlock({
    action,
    badge,
    badgeVariant = "outline",
    children,
    className,
    role,
    title,
    tone,
}: {
    action?: React.ReactNode;
    badge?: string;
    badgeVariant?: "destructive" | "outline";
    children?: React.ReactNode;
    className?: string;
    role: "alert" | "status";
    title: React.ReactNode;
    tone: StateTone;
}) {
    const Icon = TONE_ICONS[tone];

    return (
        <div
            className={cn("flex max-w-[60ch] gap-2.5 border-l-2 py-1 pl-3", TONE_CLASSES[tone].bar, className)}
            data-slot="state-block"
            data-tone={tone}
            role={role}
        >
            <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", TONE_CLASSES[tone].icon)} />
            <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
                    <div className="text-sm font-medium">{title}</div>
                </div>
                {children && <div className="text-muted-foreground wrap-break-word">{children}</div>}
                {action && <div className="pt-1">{action}</div>}
            </div>
        </div>
    );
}

/**
 * A non-error state: an expected state ("not enabled", "not available", "coming soon", a readiness state). `tone="warn"`
 * for a partial / pending answer whose rows may be incomplete.
 */
export function Notice({ action, badge, children, title, tone = "neutral" }: {
    action?: React.ReactNode;
    badge?: string;
    children?: React.ReactNode;
    title: string;
    tone?: "neutral" | "warn";
}) {
    return <StateBlock action={action} badge={badge} role="status" title={title} tone={tone}>{children}</StateBlock>;
}
