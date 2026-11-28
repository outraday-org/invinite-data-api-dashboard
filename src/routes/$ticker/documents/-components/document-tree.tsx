import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ExternalLink, FileText, Folder, FolderOpen, Link2, Mic } from "lucide-react";
import * as React from "react";

import type { V2InvestorDocument } from "@/lib/api/types";
import type { CallEntry, TreeNode } from "@/lib/earnings/documents";
import type { CallTab } from "@/routes/$ticker/earnings-calls/-components/call-tabs";

import { Badge } from "@/components/ui/badge";
import { allKeys, defaultOpenKeys, documentHref, documentKindLabel } from "@/lib/earnings/documents";
import { formatBytes } from "@/lib/earnings/format";
import { formatDay } from "@/lib/format";
import { ROW_ACTION_REVEAL_CLASS } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { AvailabilityIcons } from "@/routes/$ticker/earnings-calls/-components/availability-icons";

const actionClass = "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 whitespace-nowrap transition-colors";

// Rows share one height (36 px, ui-redesign task 11) and padding; the chevron column (`size-3.5`) is held by a spacer on
// leaf rows so every icon of a level lines up, and each nested list draws its guide line under its parent's chevron.
const rowClass = "hover:bg-muted/60 flex min-h-9 items-center gap-1.5 rounded-md px-1.5 py-1";

const guideClass = "ml-[13px] border-l pl-1";

// A document / call row: one line from `sm` up; below it the row wraps and its date + actions take their own line,
// right-aligned (the Page shell rule: the page never scrolls sideways — the actions column alone is ~250 px).
const itemRowClass = `${rowClass} group/row flex-wrap sm:flex-nowrap`;

// The kind of a document: a quiet square tag, not a pill.
const KIND_TAG_CLASS = "rounded-sm font-normal";

// A row's actions wait for hover / focus on a hover-capable pointer from `lg` up; on touch they always show.
const actionsClass = cn("flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1", ROW_ACTION_REVEAL_CLASS);

// Calls and documents reserve identical tracks, including an empty size cell for calls. Nesting only indents the
// title; the metadata stays aligned at the tree's right edge. On mobile, actions wrap in the remaining space.
const rowMetaClass = "text-muted-foreground ml-auto grid w-full shrink-0 grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 text-xs tabular-nums sm:w-auto sm:grid-cols-[6rem_4rem_12rem] sm:pl-3";

/** "Q3 2025" / "2025"; "Undated" without a year. */
function periodLabel(doc: V2InvestorDocument) {
    if (doc.year === null) return "Undated";

    return doc.period ? `${doc.period} ${doc.year}` : String(doc.year);
}

/**
 * The row's date: an SEC filing link is dated by its EDGAR filing (`filing_date`), else its fiscal period — never the
 * call's day (a 10-K is filed days after the call); every other row by its own day, else its period. A day reads
 * "Nov 3, 2026" (`formatDay`), never the raw ISO string.
 */
export function documentDate(doc: V2InvestorDocument) {
    const day = doc.kind === "sec_filing" ? doc.filing_date : doc.event_date;

    return day ? formatDay(day) : periodLabel(doc);
}

const ChevronSpacer = () => <span aria-hidden className="size-3.5 shrink-0" />;

function DocumentRow({
    doc,
    onShowText,
    ticker,
}: {
    doc: V2InvestorDocument;
    onShowText: (doc: V2InvestorDocument) => void;
    ticker: string;
}) {
    const linkOnly = doc.url === null;

    const Icon = linkOnly ? Link2 : FileText;

    // A call-sourced document gets no chip: a muted "Call" action (→ the call's Documents tab) in the actions column.
    const callEventId = doc.source === "call" ? doc.event_id : null;

    const filing = doc.kind === "sec_filing";

    return (
        <li className={itemRowClass} data-document-id={doc.document_id}>
            <ChevronSpacer />
            <Icon className="text-muted-foreground size-3.5 shrink-0" />
            <span className="min-w-0 truncate" title={doc.title ?? undefined}>{doc.title ?? "Untitled"}</span>
            <Badge className={KIND_TAG_CLASS} variant="outline">{documentKindLabel(doc.kind)}</Badge>
            {doc.link_status === "expired" && <Badge className="rounded-sm" variant="secondary">replay expired</Badge>}
            <div className={rowMetaClass}>
                <span className="whitespace-nowrap" title={filing && doc.filing_date ? "Filed on EDGAR" : undefined}>
                    {documentDate(doc)}
                </span>
                <span className="hidden text-right sm:inline">{doc.bytes !== null ? formatBytes(doc.bytes) : ""}</span>
                <div className={actionsClass}>
                    {callEventId && (
                        <CallLink aria-label="Call documents" className={actionClass} eventId={callEventId} tab="documents" ticker={ticker}>
                            Call
                        </CallLink>
                    )}
                    {doc.event_id && doc.source !== "call" && (
                        <Link
                            className={actionClass}
                            params={{ eventId: doc.event_id, ticker }}
                            search={{ tab: "documents" }}
                            to="/$ticker/earnings-calls/$eventId"
                        >
                            Event
                        </Link>
                    )}
                    {doc.pages_url && (
                        <button className={actionClass} onClick={() => onShowText(doc)} type="button">
                            Show text
                        </button>
                    )}
                    {/* A permanent public URL — only ever an href, never router state; no referrer. */}
                    <a className={actionClass} href={documentHref(doc)} rel="noopener noreferrer" target="_blank">
                        <ExternalLink className="size-3" />
                        {linkOnly ? "Open page" : "Open"}
                    </a>
                </div>
            </div>
        </li>
    );
}

/** A link to a call page (its `tab`, else the default tab). */
function CallLink({
    children,
    eventId,
    tab,
    ticker,
    ...props
}: Omit<React.ComponentProps<"a">, "href"> & { eventId: string; tab?: CallTab; ticker: string }) {
    return (
        <Link {...props} params={{ eventId, ticker }} search={tab ? { tab } : {}} to="/$ticker/earnings-calls/$eventId">
            {children}
        </Link>
    );
}

/** One call of the folder: its label and date (→ call page), what it holds, links to its press release / slides / documents. */
function CallRow({ call, historicalTicker }: { call: CallEntry; historicalTicker?: string }) {
    const { event } = call;

    const ticker = historicalTicker ?? event.symbol;

    return (
        <li className={itemRowClass} data-event-id={event.event_id}>
            <ChevronSpacer />
            <Mic className="text-primary size-3.5 shrink-0" />
            <CallLink
                className="min-w-0 truncate font-medium underline-offset-4 hover:underline"
                eventId={event.event_id}
                ticker={ticker}
            >
                {`${call.label} call`}
            </CallLink>
            {/* The shared icons are `size-3.5`; one step smaller here, in line with the row's text. */}
            <span className="text-muted-foreground [&_svg]:size-3">
                <AvailabilityIcons event={event} />
            </span>
            <div className={rowMetaClass}>
                <span className="whitespace-nowrap">{formatDay(call.date)}</span>
                <span aria-hidden className="hidden sm:inline" />
                <div className={actionsClass}>
                    {event.has_press_release && (
                        <CallLink className={actionClass} eventId={event.event_id} tab="press-release" ticker={ticker}>Press release</CallLink>
                    )}
                    {event.has_slides && <CallLink className={actionClass} eventId={event.event_id} tab="slides" ticker={ticker}>Slides</CallLink>}
                    {event.has_documents && (
                        <CallLink className={actionClass} eventId={event.event_id} tab="documents" ticker={ticker}>Documents</CallLink>
                    )}
                </div>
            </div>
        </li>
    );
}

function FolderNode({
    depth,
    historicalTicker,
    isOpen,
    node,
    onShowText,
    onToggle,
    ticker,
}: {
    depth: number;
    historicalTicker?: string;
    isOpen: (key: string) => boolean;
    node: TreeNode<V2InvestorDocument>;
    onShowText: (doc: V2InvestorDocument) => void;
    onToggle: (key: string) => void;
    ticker: string;
}) {
    const open = isOpen(node.key);

    const Chevron = open ? ChevronDown : ChevronRight;

    const FolderIcon = open ? FolderOpen : Folder;

    return (
        <li data-folder={node.key}>
            <button
                aria-expanded={open}
                className={`${rowClass} w-full text-left`}
                onClick={() => onToggle(node.key)}
                type="button"
            >
                <Chevron className="text-muted-foreground size-3.5 shrink-0" />
                <FolderIcon className="text-muted-foreground size-3.5 shrink-0" />
                <span className={depth === 0 ? "font-semibold" : "font-medium"}>{node.label}</span>
                <span className="text-muted-foreground text-xs tabular-nums">{node.count}</span>
            </button>
            {open && (
                <ul className={guideClass}>
                    {node.children.map(child => (
                        <FolderNode
                            depth={depth + 1}
                            historicalTicker={historicalTicker}
                            isOpen={isOpen}
                            key={child.key}
                            node={child}
                            onShowText={onShowText}
                            onToggle={onToggle}
                            ticker={ticker}
                        />
                    ))}
                    {node.calls.map(call => <CallRow call={call} historicalTicker={historicalTicker} key={call.event.event_id} />)}
                    {node.documents.map(doc => (
                        <DocumentRow doc={doc} key={doc.document_id} onShowText={onShowText} ticker={ticker} />
                    ))}
                </ul>
            )}
        </li>
    );
}

/**
 * The company's whole document tree (`buildDocumentTree`): category → path segments → call rows and documents, any
 * depth. By default every category is open with its newest folder at each level; under a text filter (`filtering`)
 * every folder (each holds a match) is open and the user's toggles wait until the filter is cleared. Rows open the
 * stored file (or the source page of a link-only row) in a new tab.
 */
export function DocumentTree({
    filtering = false,
    historicalTicker,
    onShowText,
    ticker,
    tree,
}: {
    filtering?: boolean;
    historicalTicker?: string;
    onShowText: (doc: V2InvestorDocument) => void;
    ticker: string;
    tree: ReadonlyArray<TreeNode<V2InvestorDocument>>;
}) {
    const defaults = React.useMemo(() => new Set(filtering ? allKeys(tree) : defaultOpenKeys(tree)), [filtering, tree]);

    // Only the keys the user toggled (by full path); the rest follow the defaults above.
    const [toggled, setToggled] = React.useState<Record<string, boolean>>({});

    const isOpen = (key: string) => (filtering ? defaults.has(key) : toggled[key] ?? defaults.has(key));

    const toggle = (key: string) => {
        if (filtering) return;

        setToggled(current => ({ ...current, [key]: !(current[key] ?? defaults.has(key)) }));
    };

    return (
        <ul className="text-sm">
            {tree.map(node => (
                <FolderNode depth={0} historicalTicker={historicalTicker} isOpen={isOpen} key={node.key} node={node} onShowText={onShowText} onToggle={toggle} ticker={ticker} />
            ))}
        </ul>
    );
}
