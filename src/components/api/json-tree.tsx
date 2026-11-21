import { ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/** Nodes deeper than this start collapsed. */
export const JSON_TREE_OPEN_DEPTH = 2;

/** Children rendered per node before "Show N more" (a 200-row answer never renders 200 subtrees at once). */
export const JSON_TREE_CHUNK = 50;

type Entry = [key: string, value: unknown];

const isContainer = (value: unknown): value is Array<unknown> | Record<string, unknown> => typeof value === "object" && value !== null;

const entriesOf = (value: Array<unknown> | Record<string, unknown>): Array<Entry> =>
    (Array.isArray(value) ? value.map((item, index): Entry => [String(index), item]) : Object.entries(value));

function Primitive({ value }: { value: unknown }) {
    if (value === null) return <span className="text-muted-foreground">null</span>;

    if (typeof value === "string") return <span className="break-all text-emerald-700 dark:text-emerald-400">{JSON.stringify(value)}</span>;

    if (typeof value === "number") return <span className="text-sky-700 dark:text-sky-400">{String(value)}</span>;

    if (typeof value === "boolean") return <span className="text-violet-700 dark:text-violet-400">{String(value)}</span>;

    return <span className="text-muted-foreground">{String(value)}</span>;
}

function Node({ depth, label, value }: { depth: number; label: null | string; value: unknown }) {
    const container = isContainer(value);

    const [open, setOpen] = React.useState(depth < JSON_TREE_OPEN_DEPTH);

    const [shown, setShown] = React.useState(JSON_TREE_CHUNK);

    const keyLabel = label === null ? null : <span className="text-foreground">{`${label}: `}</span>;

    if (!container) {
        return (
            <div className="pl-4">
                {keyLabel}
                <Primitive value={value} />
            </div>
        );
    }

    const entries = entriesOf(value);

    const summary = Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`;

    return (
        <div className={cn(depth > 0 && "pl-4")}>
            <button
                aria-expanded={open}
                className="-ml-4 inline-flex items-center gap-0.5 rounded-sm text-left hover:bg-muted"
                onClick={() => setOpen(current => !current)}
                type="button"
            >
                {open ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
                {keyLabel}
                <span className="text-muted-foreground">{summary}</span>
            </button>
            {/* Children are rendered only while open (lazy) and in chunks. */}
            {open && (
                <div>
                    {entries.slice(0, shown).map(([key, child]) => (
                        <Node depth={depth + 1} key={key} label={key} value={child} />
                    ))}
                    {entries.length > shown && (
                        <button
                            className="pl-4 text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setShown(current => current + JSON_TREE_CHUNK)}
                            type="button"
                        >
                            {`Show ${Math.min(JSON_TREE_CHUNK, entries.length - shown)} more of ${entries.length - shown}`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * A collapsible JSON view: open to depth 2, deeper nodes collapsed, a node's children mounted only once it is open and
 * then 50 at a time — a 200-row answer renders a handful of rows, never the whole tree.
 */
export function JsonTree({ className, value }: { className?: string; value: unknown }) {
    return (
        <div className={cn("pl-4 font-mono text-[0.6875rem] leading-5", className)} data-slot="json-tree">
            <Node depth={0} label={null} value={value} />
        </div>
    );
}
