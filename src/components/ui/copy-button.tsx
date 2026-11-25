import { Check, Copy } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** How long the check mark stays after a copy. */
const COPIED_MS = 1500;

/**
 * A small icon button that copies `value` (an accession number, CIK, event id, CUSIP, a curl line). `label` names what
 * is copied for screen readers ("Copy accession number"). With `children` the button shows them before the icon (the
whole text is the button, same hover as the icon alone).
 */
export function CopyButton({ children, className, label, value }: { children?: React.ReactNode; className?: string; label: string; value: string }) {
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
        if (!copied) return;

        const timer = setTimeout(() => setCopied(false), COPIED_MS);

        return () => clearTimeout(timer);
    }, [copied]);

    const copy = async (event: React.MouseEvent) => {
        // Inside a clickable row or link the copy never opens it.
        event.preventDefault();

        event.stopPropagation();

        try {
            await navigator.clipboard.writeText(value);

            setCopied(true);
        }
        catch {
            toast.error("Could not copy to the clipboard");
        }
    };

    return (
        <Button
            aria-label={label}
            className={cn("text-muted-foreground hover:text-foreground", className)}
            onClick={copy}
            size={children ? "xs" : "icon-xs"}
            title={label}
            type="button"
            variant="ghost"
        >
            {children}
            {copied ? <Check data-icon={children ? "inline-end" : undefined} /> : <Copy data-icon={children ? "inline-end" : undefined} />}
        </Button>
    );
}

/**
 * In a `DataTable` row the copy button waits for the row's hover / focus (ui-redesign task 6) — only on a pointer that
 * can hover: on touch, and outside a table, it is always shown.
 */
const ROW_REVEAL_CLASS = "[@media(hover:hover)]:in-data-[slot=data-table]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100";

/** An id (accession, CIK, CUSIP, event id) in mono with its copy button beside it (`children` = how it is shown; default the value itself). */
export function Copyable({ children, className, label, value }: { children?: React.ReactNode; className?: string; label: string; value: string }) {
    return (
        <span className={cn("inline-flex items-center gap-0.5 font-mono", className)}>
            {children ?? value}
            <CopyButton className={ROW_REVEAL_CLASS} label={label} value={value} />
        </span>
    );
}
