import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import * as React from "react";

import type { EarningsCompanyDocument } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { documentHref, documentKindLabel, groupDocumentTree, sectionLabel } from "@/lib/earnings/documents";
import { formatBytes } from "@/lib/earnings/format";

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
            <span className="min-w-0 max-w-md truncate font-medium">{doc.title ?? "Untitled"}</span>
            <span className="text-muted-foreground tabular-nums">{documentDate(doc)}</span>
            {doc.pages !== null && <span className="text-muted-foreground tabular-nums">{`${doc.pages} pp.`}</span>}
            {doc.bytes !== null && <span className="text-muted-foreground tabular-nums">{formatBytes(doc.bytes)}</span>}
            {doc.link_status === "expired" && <Badge variant="secondary">replay expired</Badge>}
            <div className="ml-auto flex items-center gap-3">
                {doc.event_id && (
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

/**
 * The company's documents as a section → year tree (`groupDocumentTree`). A section starts open; a year only when it
 * is the section's newest. Rows open the stored file (or the source page of a link-only row) in a new tab.
 */
export function DocumentTree({
    documents,
    onShowText,
    ticker,
}: {
    documents: ReadonlyArray<EarningsCompanyDocument>;
    onShowText: (doc: EarningsCompanyDocument) => void;
    ticker: string;
}) {
    const tree = React.useMemo(() => groupDocumentTree(documents), [documents]);

    // Only the keys the user toggled; the rest follow the default above.
    const [toggled, setToggled] = React.useState<Record<string, boolean>>({});

    const isOpen = (key: string, byDefault: boolean) => toggled[key] ?? byDefault;

    const toggle = (key: string, byDefault: boolean) =>
        setToggled(current => ({ ...current, [key]: !(current[key] ?? byDefault) }));

    return (
        <ul className="flex flex-col gap-3">
            {tree.map((group) => {
                const sectionOpen = isOpen(group.section, true);

                return (
                    <li className="flex flex-col gap-1" key={group.section}>
                        <Toggle onToggle={() => toggle(group.section, true)} open={sectionOpen}>
                            <span className="font-medium">{sectionLabel(group.section)}</span>
                            <span className="text-muted-foreground tabular-nums">{group.count}</span>
                        </Toggle>
                        {sectionOpen && (
                            <ul className="flex flex-col gap-1 pl-5">
                                {group.years.map((yearGroup, index) => {
                                    const key = `${group.section}:${yearGroup.year ?? "undated"}`;

                                    const yearOpen = isOpen(key, index === 0);

                                    return (
                                        <li className="flex flex-col" key={key}>
                                            <Toggle onToggle={() => toggle(key, index === 0)} open={yearOpen}>
                                                <span>{yearGroup.year ?? "Undated"}</span>
                                                <span className="text-muted-foreground tabular-nums">{yearGroup.documents.length}</span>
                                            </Toggle>
                                            {yearOpen && (
                                                <ul className="pl-5">
                                                    {yearGroup.documents.map(doc => (
                                                        <DocumentRow doc={doc} key={doc.document_id} onShowText={onShowText} ticker={ticker} />
                                                    ))}
                                                </ul>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
