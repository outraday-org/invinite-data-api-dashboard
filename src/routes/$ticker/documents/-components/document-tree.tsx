import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ExternalLink, FileText, Folder, FolderOpen, Link2, Mic } from "lucide-react";
import * as React from "react";

import type { EarningsCompanyDocument } from "@/lib/api/types";
import type { CallEntry, TreeNode } from "@/lib/earnings/documents";
import type { CallTab } from "@/routes/$ticker/earnings-calls/-components/call-tabs";

import { Badge } from "@/components/ui/badge";
import { allKeys, defaultOpenKeys, documentHref, documentKindLabel } from "@/lib/earnings/documents";
import { formatBytes } from "@/lib/earnings/format";
import { AvailabilityIcons } from "@/routes/$ticker/earnings-calls/-components/availability-icons";

const actionClass = "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 whitespace-nowrap transition-colors";

// Rows share one height and padding; the chevron column (`size-3.5`) is held by a spacer on leaf rows so every icon
// of a level lines up, and each nested list draws its guide line under its parent's chevron.
const rowClass = "hover:bg-muted/60 flex min-h-7 items-center gap-1.5 rounded-md px-1.5 py-0.5";

const guideClass = "ml-[13px] border-l pl-1";

/** "Q3 2025" / "2025" / the event's day; "Undated" without either. */
function documentDate(doc: EarningsCompanyDocument) {
    if (doc.event_date) return doc.event_date;

    if (doc.year === null) return "Undated";

    return doc.period ? `${doc.period} ${doc.year}` : String(doc.year);
}

const ChevronSpacer = () => <span aria-hidden className="size-3.5 shrink-0" />;

function DocumentRow({
    doc,
    onShowText,
    ticker,
}: {
    doc: EarningsCompanyDocument;
    onShowText: (doc: EarningsCompanyDocument) => void;
    ticker: string;
}) {
    const linkOnly = doc.url === null;

    const Icon = linkOnly ? Link2 : FileText;

    return (
        <li className={`${rowClass} group`} data-document-id={doc.document_id}>
            <ChevronSpacer />
            <Icon className="text-muted-foreground size-3.5 shrink-0" />
            <span className="min-w-0 truncate" title={doc.title ?? undefined}>{doc.title ?? "Untitled"}</span>
            <Badge className="font-normal" variant="outline">{documentKindLabel(doc.kind)}</Badge>
            {doc.source === "call" && doc.event_id && (
                <CallLink aria-label="Call documents" eventId={doc.event_id} tab="documents" ticker={ticker}>
                    <Badge variant="secondary">Call</Badge>
                </CallLink>
            )}
            {doc.link_status === "expired" && <Badge variant="secondary">replay expired</Badge>}
            <div className="text-muted-foreground ml-auto flex shrink-0 items-center gap-3 pl-3 text-xs tabular-nums">
                <span className="w-20">{documentDate(doc)}</span>
                <span className="hidden w-12 text-right sm:inline">{doc.pages !== null ? `${doc.pages} pp.` : ""}</span>
                <span className="hidden w-16 text-right sm:inline">{doc.bytes !== null ? formatBytes(doc.bytes) : ""}</span>
                <div className="flex w-36 items-center justify-end gap-2.5">
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
                    {/* Presigned: a bearer credential — only ever an href, never router state; no referrer. */}
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
function CallRow({ call }: { call: CallEntry }) {
    const { event } = call;

    const ticker = event.symbol;

    return (
        <li className={rowClass} data-event-id={event.event_id}>
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
            <div className="text-muted-foreground ml-auto flex shrink-0 items-center gap-3 pl-3 text-xs tabular-nums">
                <span className="w-20">{call.date}</span>
                <div className="flex items-center justify-end gap-2.5">
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
    isOpen,
    node,
    onShowText,
    onToggle,
    ticker,
}: {
    depth: number;
    isOpen: (key: string) => boolean;
    node: TreeNode<EarningsCompanyDocument>;
    onShowText: (doc: EarningsCompanyDocument) => void;
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
                            isOpen={isOpen}
                            key={child.key}
                            node={child}
                            onShowText={onShowText}
                            onToggle={onToggle}
                            ticker={ticker}
                        />
                    ))}
                    {node.calls.map(call => <CallRow call={call} key={call.event.event_id} />)}
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
    onShowText,
    ticker,
    tree,
}: {
    filtering?: boolean;
    onShowText: (doc: EarningsCompanyDocument) => void;
    ticker: string;
    tree: ReadonlyArray<TreeNode<EarningsCompanyDocument>>;
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
                <FolderNode depth={0} isOpen={isOpen} key={node.key} node={node} onShowText={onShowText} onToggle={toggle} ticker={ticker} />
            ))}
        </ul>
    );
}
