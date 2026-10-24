import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import * as React from "react";

import type { EarningsCompanyDocument } from "@/lib/api/types";
import type { CallEntry, TreeNode } from "@/lib/earnings/documents";
import type { CallTab } from "@/routes/$ticker/earnings-calls/-components/call-tabs";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { allKeys, defaultOpenKeys, documentHref, documentKindLabel } from "@/lib/earnings/documents";
import { formatBytes } from "@/lib/earnings/format";
import { AvailabilityIcons } from "@/routes/$ticker/earnings-calls/-components/availability-icons";

const linkClass = "inline-flex items-center gap-1 underline-offset-4 hover:underline";

/** "Q3 2025" / "2025" / the event's day; "Undated" without either. */
function documentDate(doc: EarningsCompanyDocument) {
    if (doc.event_date) return doc.event_date;

    if (doc.year === null) return "Undated";

    return doc.period ? `${doc.period} ${doc.year}` : String(doc.year);
}

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

    return (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-1.5 last:border-b-0" data-document-id={doc.document_id}>
            <Badge variant="outline">{documentKindLabel(doc.kind)}</Badge>
            {doc.source === "call" && doc.event_id && (
                <CallLink aria-label="Call documents" eventId={doc.event_id} tab="documents" ticker={ticker}>
                    <Badge variant="secondary">Call</Badge>
                </CallLink>
            )}
            <span className="min-w-0 max-w-md truncate font-medium">{doc.title ?? "Untitled"}</span>
            <span className="text-muted-foreground tabular-nums">{documentDate(doc)}</span>
            {doc.pages !== null && <span className="text-muted-foreground tabular-nums">{`${doc.pages} pp.`}</span>}
            {doc.bytes !== null && <span className="text-muted-foreground tabular-nums">{formatBytes(doc.bytes)}</span>}
            {doc.link_status === "expired" && <Badge variant="secondary">replay expired</Badge>}
            <div className="ml-auto flex items-center gap-3">
                {doc.event_id && doc.source !== "call" && (
                    <Link
                        className={linkClass}
                        params={{ eventId: doc.event_id, ticker }}
                        search={{ tab: "documents" }}
                        to="/$ticker/earnings-calls/$eventId"
                    >
                        Event
                    </Link>
                )}
                {/* Presigned: a bearer credential — only ever an href, never router state; no referrer. */}
                <a className={linkClass} href={documentHref(doc)} rel="noopener noreferrer" target="_blank">
                    <ExternalLink className="size-3" />
                    {linkOnly ? "Open page" : "Open"}
                </a>
                {doc.pages_url && (
                    <Button onClick={() => onShowText(doc)} size="xs" type="button" variant="ghost">
                        Show text
                    </Button>
                )}
            </div>
        </li>
    );
}

function Toggle({ children, onToggle, open }: { children: React.ReactNode; onToggle: () => void; open: boolean }) {
    const Icon = open ? ChevronDown : ChevronRight;

    return (
        <button aria-expanded={open} className="hover:text-foreground flex w-fit items-center gap-1 text-left" onClick={onToggle} type="button">
            <Icon className="size-3.5 shrink-0" />
            {children}
        </button>
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
        <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-1.5 last:border-b-0" data-event-id={event.event_id}>
            <Badge variant="secondary">Call</Badge>
            <CallLink className={`${linkClass} font-medium`} eventId={event.event_id} ticker={ticker}>
                {`${call.label} call`}
            </CallLink>
            <span className="text-muted-foreground tabular-nums">{call.date}</span>
            <AvailabilityIcons event={event} />
            <div className="ml-auto flex items-center gap-3">
                {event.has_press_release && (
                    <CallLink className={linkClass} eventId={event.event_id} tab="press-release" ticker={ticker}>Press release</CallLink>
                )}
                {event.has_slides && <CallLink className={linkClass} eventId={event.event_id} tab="slides" ticker={ticker}>Slides</CallLink>}
                {event.has_documents && (
                    <CallLink className={linkClass} eventId={event.event_id} tab="documents" ticker={ticker}>Documents</CallLink>
                )}
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

    return (
        <li className="flex flex-col gap-1" data-folder={node.key}>
            <Toggle onToggle={() => onToggle(node.key)} open={open}>
                <span className={depth === 0 ? "font-medium" : undefined}>{node.label}</span>
                <span className="text-muted-foreground tabular-nums">{node.count}</span>
            </Toggle>
            {open && (
                <ul className="flex flex-col gap-1 pl-5">
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
                    {(node.calls.length > 0 || node.documents.length > 0) && (
                        <li>
                            <ul>
                                {node.calls.map(call => <CallRow call={call} key={call.event.event_id} />)}
                                {node.documents.map(doc => (
                                    <DocumentRow doc={doc} key={doc.document_id} onShowText={onShowText} ticker={ticker} />
                                ))}
                            </ul>
                        </li>
                    )}
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
        <ul className="flex flex-col gap-3">
            {tree.map(node => (
                <FolderNode depth={0} isOpen={isOpen} key={node.key} node={node} onShowText={onShowText} onToggle={toggle} ticker={ticker} />
            ))}
        </ul>
    );
}
