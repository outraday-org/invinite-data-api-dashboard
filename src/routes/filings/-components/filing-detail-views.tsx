import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import * as React from "react";

import type { ListState } from "@/lib/api/list-state";
import type {
    JsonValue,
    V2DocumentSection,
    V2DocumentSectionsResponse,
    V2FactPlace,
    V2FactPlacesResponse,
    V2FiledHolding,
    V2FilingDetailResponse,
    V2FilingFact,
    V2FilingFactsResponse,
    V2FilingHoldingsResponse,
    V2FilingNote,
    V2FilingNotesResponse,
    V2ReviewChainResponse,
} from "@/lib/api/types";

import { count, money, right, weightText } from "@/components/sec/fund-views";
import { SecListFrame } from "@/components/sec/sec-list-frame";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { filerCikParam, SecurityLink } from "@/components/sec/security-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copyable } from "@/components/ui/copy-button";
import { Skeleton } from "@/components/ui/skeleton";
import { DASH, formatDay, formatNumber } from "@/lib/format";
import { boolOf, listOf, numberOf, recordOf, scalarEntries, textOf } from "@/lib/sec/source";

/**
 * The tabs of the filing page `/filings/$accession` (backend tasks/data-api-dashboard O7 group 3), pure: state in,
 * markup out. Facts / notes (`/facts`, `/notes`), the review chain (`/review-chain`), the reported holdings of a 13F-HR
 * / NPORT-P (`/holdings`), parties & relations (`expand=parties,relations`), a document version's sections
 * (`/sections`) and fact places (`/v1/fact-places`, PRO). Every list states its coverage; a pending / partial answer
 * is never "nothing".
 */

const linkClass = "text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline";

/** The forms whose reported lines `/holdings` serves (13F-HR, NPORT-P and their amendments). */
export function hasFiledHoldings(form: null | string | undefined) {
    return Boolean(form && /^(13F-HR|NPORT-P)/i.test(form));
}

/** The first block id of a section (`blocks` = `b00107-b00244` selectors), the reader's focus. */
export function sectionStartBlock(section: Pick<V2DocumentSection, "blocks">): null | string {
    const first = section.blocks?.at(0);

    const match = first ? /^b\d+/.exec(first) : null;

    return match ? match[0] : null;
}

/** "srt:ProductOrServiceAxis = us-gaap:ProductMember; …" (empty = consolidated). */
export function dimensionsText(dimensions: ReadonlyArray<{ axis: string; member: string }> | undefined) {
    return (dimensions ?? []).map(dimension => `${dimension.axis} = ${dimension.member}`).join("; ");
}

/** A fact's period: the duration `start – end`, the instant, or the end alone. */
export function factPeriodText(fact: Pick<V2FilingFact, "instant" | "period_end" | "period_start">) {
    if (fact.period_start && fact.period_end) return `${formatDay(fact.period_start)} – ${formatDay(fact.period_end)}`;

    return formatDay(fact.instant ?? fact.period_end);
}

/** A fact's value as filed (unscaled), `nil` for a stated nil. */
export function factValueText(fact: Pick<V2FilingFact, "unit" | "value">) {
    if (fact.value === null) return "nil";

    return formatNumber(fact.value, { maximumFractionDigits: 6 });
}

// ── Facts ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const FACT_COLUMNS: Array<ColumnDef<V2FilingFact>> = [
    { cell: ({ row }) => <span className="font-medium break-all">{row.original.tag}</span>, header: "Concept", id: "tag" },
    { cell: ({ row }) => right(factValueText(row.original)), header: () => <div className="text-right">Value</div>, id: "value" },
    { cell: ({ row }) => row.original.unit ?? DASH, header: "Unit", id: "unit" },
    { cell: ({ row }) => right(row.original.decimals === null ? DASH : String(row.original.decimals)), header: () => <div className="text-right">Decimals</div>, id: "decimals" },
    { cell: ({ row }) => <span className="tabular-nums whitespace-nowrap">{factPeriodText(row.original)}</span>, header: "Period", id: "period" },
    { cell: ({ row }) => <span className="text-muted-foreground text-xs">{dimensionsText(row.original.dimensions) || "Consolidated"}</span>, header: "Dimensions", id: "dimensions" },
];

/** A filing's numeric XBRL facts as filed (SEC financial statement data sets). */
export function FilingFactsView({ accession, state }: { accession: string; state: ListState<V2FilingFactsResponse> }) {
    return (
        <SecListFrame<V2FilingFact>
            columns={FACT_COLUMNS}
            emptyText="This filing states no numeric facts."
            errorTitle="Failed to load the filing's facts"
            exportConfig={{ dataset: "filing-facts", scope: accession }}
            operationId="listFilingFacts"
            state={state}
        />
    );
}

// ── Notes ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Characters of a note shown before "Show all". */
const NOTE_PREVIEW = 400;

function NoteText({ text }: { text: string }) {
    const [open, setOpen] = React.useState(false);

    const long = text.length > NOTE_PREVIEW;

    return (
        <div className="flex max-w-3xl flex-col items-start gap-1">
            <p className="leading-relaxed whitespace-pre-wrap">{open || !long ? text : `${text.slice(0, NOTE_PREVIEW)}…`}</p>
            {long && (
                <Button onClick={() => setOpen(value => !value)} size="xs" type="button" variant="ghost">
                    {open ? "Show less" : "Show all"}
                </Button>
            )}
        </div>
    );
}

const NOTE_COLUMNS: Array<ColumnDef<V2FilingNote>> = [
    {
        cell: ({ row }) => (
            <div className="flex flex-col gap-0.5">
                <span className="font-medium break-all">{row.original.tag}</span>
                {row.original.period_end && <span className="text-muted-foreground text-xs">{`Period end ${formatDay(row.original.period_end)}`}</span>}
                {row.original.dimensions.length > 0 && <span className="text-muted-foreground text-xs">{dimensionsText(row.original.dimensions)}</span>}
            </div>
        ),
        header: "Concept",
        id: "tag",
    },
    { cell: ({ row }) => <NoteText text={row.original.text} />, header: "Text", id: "text" },
];

/** A filing's text facts (XBRL text blocks) as filed. */
export function FilingNotesView({ accession, state }: { accession: string; state: ListState<V2FilingNotesResponse> }) {
    return (
        <SecListFrame<V2FilingNote>
            columns={NOTE_COLUMNS}
            emptyText="This filing states no text blocks."
            errorTitle="Failed to load the filing's notes"
            exportConfig={{ dataset: "filing-notes", scope: accession }}
            operationId="listFilingNotes"
            state={state}
        />
    );
}

// ── Holdings ──────────────────────────────────────────────────────────────────────────────────────────────────────

const HOLDING_COLUMNS: Array<ColumnDef<V2FiledHolding>> = [
    {
        cell: ({ row }) => (
            <SecurityLink className="font-medium" security={row.original.security}>
                {row.original.security.name ?? row.original.security.symbol ?? DASH}
            </SecurityLink>
        ),
        header: "Security",
        id: "security",
    },
    { cell: ({ row }) => row.original.security.symbol ?? DASH, header: "Ticker", id: "symbol" },
    {
        cell: ({ row }) => (row.original.security.cusip ? <Copyable label="Copy CUSIP" value={row.original.security.cusip} /> : DASH),
        header: "CUSIP",
        id: "cusip",
    },
    { cell: ({ row }) => row.original.security.isin ?? DASH, header: "ISIN", id: "isin" },
    {
        cell: ({ row }) => right(`${count(row.original.shares)}${row.original.shares_type ? ` ${row.original.shares_type}` : ""}`),
        header: () => <div className="text-right">Shares</div>,
        id: "shares",
    },
    { cell: ({ row }) => right(money(row.original.value_usd)), header: () => <div className="text-right">Value</div>, id: "value" },
    { cell: ({ row }) => right(weightText(row.original.weight_pct)), header: () => <div className="text-right">Weight</div>, id: "weight" },
    {
        cell: ({ row }) => [row.original.asset_cat, row.original.put_call, row.original.investment_discretion].filter(Boolean).join(" · ") || DASH,
        header: "Category · option · discretion",
        id: "kind",
    },
    {
        cell: ({ row }) => {
            const voting = row.original.voting_authority;

            return voting ? <span className="tabular-nums text-xs">{`${count(voting.sole)} / ${count(voting.shared)} / ${count(voting.none)}`}</span> : DASH;
        },
        header: "Voting sole / shared / none",
        id: "voting",
    },
];

const FAMILY_LABELS: Record<"13f" | "nport", string> = { "13f": "13F information table", "nport": "N-PORT report" };

/** The reported lines of one 13F-HR / NPORT-P filing as filed, in the filing's line order (`meta.family`). */
export function FilingHoldingsView({ accession, state }: { accession: string; state: ListState<V2FilingHoldingsResponse> }) {
    const family = state.pages.at(0)?.meta.family;

    return (
        <SecListFrame<V2FiledHolding>
            columns={HOLDING_COLUMNS}
            emptyText="This filing reports no lines."
            errorTitle="Failed to load the filing's holdings"
            exportConfig={{ dataset: "filing-holdings", scope: accession }}
            note={family ? <div className="text-muted-foreground text-xs">{`${FAMILY_LABELS[family]}, lines as filed (no issuer resolution).`}</div> : null}
            operationId="listFilingHoldings"
            state={state}
        />
    );
}

// ── Sections and fact places of a document version ───────────────────────────────────────────────────────────────

/** A document version's section outline (`generic` headings or the `legacy` section ids); a row opens its first block. */
export function DocumentSectionsView({ onOpenBlock, state }: { onOpenBlock: (blockId: string) => void; state: ListState<V2DocumentSectionsResponse> }) {
    const columns: Array<ColumnDef<V2DocumentSection>> = [
        { cell: ({ row }) => right(String(row.original.ordinal)), header: () => <div className="text-right">#</div>, id: "ordinal" },
        { cell: ({ row }) => [row.original.part, row.original.item_id ? `Item ${row.original.item_id}` : null].filter(Boolean).join(" · ") || DASH, header: "Part · item", id: "item" },
        {
            cell: ({ row }) => {
                const block = sectionStartBlock(row.original);

                return block
                    ? <button className="text-primary cursor-pointer text-left hover:underline" onClick={() => onOpenBlock(block)} type="button">{row.original.title}</button>
                    : row.original.title;
            },
            header: "Heading",
            id: "title",
        },
        { cell: ({ row }) => <span className="text-muted-foreground text-xs tabular-nums">{(row.original.blocks ?? []).join(", ")}</span>, header: "Blocks", id: "blocks" },
    ];

    return (
        <SecListFrame<V2DocumentSection>
            columns={columns}
            emptyText="This document has no sections in this outline."
            errorTitle="Failed to load the sections"
            operationId="listDocumentSections"
            state={state}
        />
    );
}

const PLACE_STATUS_LABELS: Record<V2FactPlace["status"], string> = {
    derived: "Derived",
    hidden: "Hidden",
    not_in_document: "Not in document",
    placed: "Placed",
    unmatched: "Unmatched",
};

/** Where facts sit in one document version (PRO): concept, status, the block (opens the reader), table cell, page, the annotated rendition. */
export function FactPlacesView({ onOpenBlock, state, versionId }: { onOpenBlock: (blockId: string) => void; state: ListState<V2FactPlacesResponse>; versionId: string }) {
    const columns: Array<ColumnDef<V2FactPlace>> = [
        { cell: ({ row }) => <span className="font-medium break-all">{row.original.concept}</span>, header: "Concept", id: "concept" },
        { cell: ({ row }) => <Badge variant={row.original.status === "placed" ? "secondary" : "outline"}>{PLACE_STATUS_LABELS[row.original.status]}</Badge>, header: "Status", id: "status" },
        {
            cell: ({ row }) => {
                const block = row.original.block_id;

                return block
                    ? <button className="text-primary cursor-pointer hover:underline" onClick={() => onOpenBlock(block)} type="button">{`Block ${block}`}</button>
                    : DASH;
            },
            header: "Block",
            id: "block",
        },
        {
            cell: ({ row }) => {
                const { page, table_col: col, table_row: tableRow } = row.original;

                const cell = tableRow !== null && col !== null ? `row ${tableRow}, col ${col}` : null;

                return <span className="text-muted-foreground text-xs">{[page !== null ? `p. ${page}` : null, cell].filter(Boolean).join(" · ") || DASH}</span>;
            },
            header: "Page · table cell",
            id: "place",
        },
        { cell: ({ row }) => <span className="text-muted-foreground text-xs break-all">{row.original.html_tag_id ?? DASH}</span>, header: "Element id", id: "html_tag_id" },
        {
            cell: ({ row }) => (row.original.rendition_url?.startsWith("https://")
                ? (
                        <a className={linkClass} href={row.original.rendition_url} rel="noopener noreferrer" target="_blank">
                            <ExternalLink className="size-3" />
                            Annotated
                        </a>
                    )
                : DASH),
            header: "Rendition",
            id: "rendition",
        },
    ];

    return (
        <SecListFrame<V2FactPlace>
            columns={columns}
            emptyText="No fact is placed in this document."
            errorTitle="Failed to load the fact places"
            exportConfig={{ dataset: "fact-places", scope: versionId }}
            operationId="listFactPlaces"
            state={state}
        />
    );
}

// ── Review chain ──────────────────────────────────────────────────────────────────────────────────────────────────

export type ReviewNodeView = { accession: null | string; depth: null | number; fileNumber: null | string; filingDate: null | string; form: null | string };

/** The chain's nodes (free JSON in the spec) through guards. */
export function toReviewNodes(nodes: ReadonlyArray<JsonValue>): Array<ReviewNodeView> {
    return nodes.map((node) => {
        const record = recordOf(node);

        return {
            accession: textOf(record, "accession"),
            depth: numberOf(record, "depth"),
            fileNumber: textOf(record, "file_number"),
            filingDate: textOf(record, "filing_date"),
            form: textOf(record, "form"),
        };
    });
}

/** "Cut at depth 1 / 100 nodes · 2 unresolved relations" (what the chain's `completeness` names). */
export function reviewCompletenessText(completeness: JsonValue): Array<string> {
    const record = recordOf(completeness);

    const lines: Array<string> = [];

    if (boolOf(record, "truncated")) lines.push(`Cut at ${numberOf(record, "max_depth") ?? "?"} hops / ${numberOf(record, "max_nodes") ?? "?"} nodes`);

    const unresolved = numberOf(record, "unresolved_edges");

    if (unresolved) lines.push(`${unresolved} relation${unresolved === 1 ? "" : "s"} not resolved yet`);

    const unresolvedNodes = listOf(record.unresolved_review_nodes).length;

    if (unresolvedNodes > 0) lines.push(`${unresolvedNodes} letter${unresolvedNodes === 1 ? "" : "s"} not resolved yet`);

    const notHeld = listOf(record.not_held_nodes).length;

    if (notHeld > 0) lines.push(`${notHeld} filing${notHeld === 1 ? "" : "s"} not held`);

    return lines;
}

/** The comment-letter graph around a filing: its filings (each opens its page), relations and twins as stated. */
export function ReviewChainView({ data, error, isLoading }: { data: null | V2ReviewChainResponse; error: unknown; isLoading: boolean }) {
    if (error) return <SecReadinessNotice error={error} title="Failed to load the review chain" titles={{ not_ready: "The review store is switched off" }} />;

    if (isLoading && !data) return <Skeleton className="h-24 w-full" />;

    if (!data) return null;

    const nodes = toReviewNodes(data.nodes);

    const completeness = reviewCompletenessText(data.completeness);

    const onlyItself = nodes.length <= 1 && data.edges.length === 0;

    return (
        <section aria-label="Review chain" className="flex flex-col gap-3">
            {completeness.length > 0 && (
                <div className="text-muted-foreground flex flex-col text-xs" role="status">
                    {completeness.map(line => <span key={line}>{line}</span>)}
                </div>
            )}
            {onlyItself && (
                <div className="text-muted-foreground text-sm">
                    No comment letters relate to this filing (or its letters are not resolved yet).
                </div>
            )}
            {!onlyItself && (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="text-muted-foreground text-left">
                            <tr>
                                <th className="p-1 font-normal">Filing</th>
                                <th className="p-1 font-normal">Form</th>
                                <th className="p-1 font-normal">Filed</th>
                                <th className="p-1 font-normal">File number</th>
                                <th className="p-1 text-right font-normal">Hops</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nodes.map((node, index) => (
                                <tr key={node.accession ?? index}>
                                    <td className="p-1">
                                        {node.accession && node.accession !== data.accession
                                            ? <Link className={linkClass} params={{ accession: node.accession }} to="/filings/$accession">{node.accession}</Link>
                                            : <span className="font-medium">{node.accession ?? DASH}</span>}
                                    </td>
                                    <td className="p-1">{node.form ?? DASH}</td>
                                    <td className="p-1 tabular-nums">{formatDay(node.filingDate)}</td>
                                    <td className="p-1">{node.fileNumber ?? DASH}</td>
                                    <td className="p-1 text-right tabular-nums">{node.depth ?? DASH}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {data.edges.length > 0 && <StatedRows label="Relations" rows={data.edges} />}
            {data.twins.length > 0 && <StatedRows label="Twins" rows={data.twins} />}
        </section>
    );
}

/** Free-form rows (relations, twins) as their stated scalar fields. */
function StatedRows({ label, rows }: { label: string; rows: ReadonlyArray<JsonValue> }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="text-muted-foreground text-xs font-medium">{label}</div>
            <ul className="flex flex-col gap-1 text-xs">
                {rows.map((row, index) => (
                    // A relation has no id of its own: its position in the stated list is stable.

                    <li className="rounded border px-2 py-1" key={index}>
                        {scalarEntries(row).map(([key, value]) => `${key}: ${value}`).join(" · ") || DASH}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ── Parties and relations ─────────────────────────────────────────────────────────────────────────────────────────

/** The filing's parties (who filed, who is the subject, …) and its documents' relations (`expand=parties,relations`). */
export function FilingPartiesView({ data, error, isLoading }: { data: null | V2FilingDetailResponse; error: unknown; isLoading: boolean }) {
    if (error) return <SecReadinessNotice error={error} title="Failed to load the filing's parties" />;

    if (isLoading && !data) return <Skeleton className="h-24 w-full" />;

    if (!data) return null;

    const parties = (data.parties ?? []).map(party => recordOf(party));

    const relations = (data.relations ?? []).map(relation => recordOf(relation));

    return (
        <div className="flex flex-col gap-4">
            <section aria-label="Parties" className="flex flex-col gap-1">
                <div className="text-muted-foreground text-xs font-medium">Parties</div>
                {parties.length === 0
                    ? <div className="text-muted-foreground text-xs">This filing names no parties.</div>
                    : (
                            <table className="w-full text-xs">
                                <thead className="text-muted-foreground text-left">
                                    <tr>
                                        <th className="p-1 font-normal">Name</th>
                                        <th className="p-1 font-normal">CIK</th>
                                        <th className="p-1 font-normal">Role</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parties.map((party, index) => {
                                        const cik = filerCikParam(textOf(party, "cik"));

                                        return (
                                        // A party has no id of its own (one CIK can hold several roles).

                                            <tr key={index}>
                                                <td className="p-1">{textOf(party, "name") ?? DASH}</td>
                                                <td className="p-1 tabular-nums">
                                                    {cik ? <Link className={linkClass} params={{ cik }} to="/sec/$cik">{cik}</Link> : DASH}
                                                </td>
                                                <td className="p-1">{textOf(party, "role") ?? DASH}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
            </section>
            <section aria-label="Relations" className="flex flex-col gap-1">
                <div className="text-muted-foreground text-xs font-medium">Relations between its documents</div>
                {relations.length === 0
                    ? <div className="text-muted-foreground text-xs">No relations stated.</div>
                    : (
                            <ul className="flex flex-col gap-0.5 text-xs">
                                {relations.map((relation, index) => (

                                    <li key={index}>
                                        <span className="font-medium">{textOf(relation, "from") ?? DASH}</span>
                                        <span className="text-muted-foreground">{` ${(textOf(relation, "relation") ?? "relates to").replaceAll("_", " ")} `}</span>
                                        <span className="font-medium">{textOf(relation, "to") ?? DASH}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
            </section>
        </div>
    );
}
