import type { ColumnDef } from "@tanstack/react-table";
import type * as React from "react";

import { Link } from "@tanstack/react-router";

import type { ListState } from "@/lib/api/list-state";
import type {
    V2FilerHoldingChangesResponse,
    V2Holder,
    V2HolderChange,
    V2HolderChangesResponse,
    V2HolderChangeType,
    V2HolderSection,
    V2HolderSource,
    V2HoldersResponse,
} from "@/lib/api/types";

import { count, money, weightText } from "@/components/sec/fund-views";
import { SecListFrame } from "@/components/sec/sec-list-frame";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { filerCikParam, SecurityLink } from "@/components/sec/security-link";
import { V2MetaLine } from "@/components/sec/v2-meta-line";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, right } from "@/components/ui/data-table";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/lib/format";
import {
    HOLDER_SECTION_STATE_LABELS,
    HOLDER_SOURCE_LABELS,
    HOLDER_SOURCE_NOTES,
    holderReasonText,
} from "@/lib/sec/fund";
import { formatNumberEn } from "@/lib/utils";

/**
 * Who holds a security (Data API 7.0, `/v1/holders`, owner decision 12): ONE row schema (`Holder`) for the three
 * sources — 13F managers, N-PORT funds, ETF issuer files — rendered by one table whose columns follow the source.
 * Without `source=` the API answers an overview: each source's top rows one after another in `data`, described by
 * `meta.sections[]`; the sources overlap, so they are never merged or summed. Pure views (state in, markup out).
 */

const day = (value: null | string | undefined) => formatDay(value);

/**
 * The holder: a 13F manager links its filer page (its 13F portfolio); a listed fund its page (`holder.symbols`); an
 * unlisted fund (no resource in the contract, decision 13) is marked "Unlisted" and links its trust's filer page
 * (`holder.cik` = the registrant), the series id in the tooltip.
 */
export function HolderCell({ holder }: { holder: V2Holder["holder"] }) {
    const name = holder.name ?? holder.registrant_name ?? holder.cik ?? holder.fund_key ?? "—";

    const title = [holder.registrant_name, holder.series_id ?? holder.fund_key, holder.cik ? `CIK ${holder.cik}` : null]
        .filter(Boolean)
        .join(" · ");

    const symbol = holder.symbols.at(0);

    const cik = filerCikParam(holder.cik);

    const linkClass = "truncate font-medium underline-offset-4 hover:underline";

    let cell: React.ReactNode;

    if (holder.type === "institution" && cik) {
        cell = <Link className={linkClass} params={{ cik }} title={`13F manager · CIK ${cik}: its filer page and portfolio`} to="/sec/$cik">{name}</Link>;
    }
    else if (symbol) {
        cell = <Link className={linkClass} params={{ ticker: symbol }} title={title} to="/$ticker">{name}</Link>;
    }
    else {
        const trustTitle = [`Trust: ${holder.registrant_name ?? `CIK ${cik ?? "?"}`}`, holder.series_id ? `series ${holder.series_id}` : null].filter(Boolean).join(" · ");

        cell = (
            <>
                <span className="truncate" title={title}>{name}</span>
                {holder.type === "fund" && <Badge title="A fund without a listed ticker (e.g. a mutual fund)" variant="outline">Unlisted</Badge>}
                {holder.type === "fund" && cik && (
                    <Link className="text-muted-foreground shrink-0 underline-offset-4 hover:underline" params={{ cik }} title={trustTitle} to="/sec/$cik">
                        trust
                    </Link>
                )}
            </>
        );
    }

    // A max width: a long fund name truncates instead of widening the (pinned) first column.
    return (
        <div className="flex max-w-40 min-w-0 items-center gap-2 sm:max-w-56">
            {cell}
            {holder.issuer_file_as_of && (
                <Badge title="This fund also has an issuer holdings file, a fresher source than its N-PORT report" variant="outline">
                    {`Issuer file ${formatDay(holder.issuer_file_as_of)}`}
                </Badge>
            )}
        </div>
    );
}

const tickersText = (holder: V2Holder["holder"]) => {
    const tickers = holder.symbols.length > 0 ? holder.symbols : (holder.class_tickers ?? []);

    return tickers.join(", ") || "—";
};

/** "SH · Put": the unit and an option's side. */
export const sharesTypeText = (row: Pick<V2Holder, "put_call" | "shares_type">) => [row.shares_type, row.put_call].filter(Boolean).join(" · ") || "—";

const AS_OF: ColumnDef<V2Holder> = { cell: ({ row }) => day(row.original.as_of), header: "As of", id: "as_of" };

const FILED: ColumnDef<V2Holder> = { cell: ({ row }) => day(row.original.filing_date), header: "Filed", id: "filing_date" };

const HOLDER: ColumnDef<V2Holder> = { cell: ({ row }) => <HolderCell holder={row.original.holder} />, header: "Holder", id: "holder" };

const TICKERS: ColumnDef<V2Holder> = { cell: ({ row }) => tickersText(row.original.holder), header: "Tickers", id: "tickers" };

const SHARES: ColumnDef<V2Holder> = {
    cell: ({ row }) => right(count(row.original.shares)),
    header: () => <div className="text-right">Shares</div>,
    id: "shares",
};

const SHARES_TYPE: ColumnDef<V2Holder> = { cell: ({ row }) => sharesTypeText(row.original), header: "Unit", id: "shares_type" };

const VALUE: ColumnDef<V2Holder> = {
    cell: ({ row }) => right(money(row.original.value_usd)),
    header: () => <div className="text-right">Value</div>,
    id: "value_usd",
};

const WEIGHT: ColumnDef<V2Holder> = {
    cell: ({ row }) => right(weightText(row.original.weight_pct)),
    header: () => <div className="text-right">% of fund</div>,
    id: "weight_pct",
};

const DISCRETION_LABELS: Record<string, string> = { DFND: "Shared (defined)", OTR: "Shared (other)", SOLE: "Sole" };

/** 13F investment discretion as filed (`SOLE`, `DFND`, `OTR`) in words; an unknown code stays as filed. */
export const discretionText = (code: null | string | undefined) => (code ? (DISCRETION_LABELS[code] ?? code) : "—");

/** 13F voting authority (shares): "Sole 1,200 · Shared 0 · None 300"; null on N-PORT and issuer-file rows (exact: a title, `/sec/$cik`). */
export function votingText(voting: V2Holder["voting_authority"]): string {
    if (!voting) return "—";

    const parts: Array<[string, null | number]> = [["Sole", voting.sole], ["Shared", voting.shared], ["None", voting.none]];

    return parts.map(([label, value]) => `${label} ${count(value)}`).join(" · ");
}

const DISCRETION: ColumnDef<V2Holder> = { cell: ({ row }) => discretionText(row.original.investment_discretion), header: "Discretion", id: "investment_discretion" };

const compactShares = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3, notation: "compact" });

/** One share count of the voting cell, compact to 3 digits ("1.39B", "542M"); none stated = "—". */
const compactCount = (value: null | number) => (value == null || !Number.isFinite(value) ? "—" : compactShares.format(value));

const VOTING_ORDER = "Voting authority in shares: sole · shared · none";

/**
 * The three voting authorities in one cell (ui-redesign task 8: the spelled-out "Sole … · Shared … · None …" was the
 * widest cell of the 13F table): three right-aligned compact numbers on a fixed grid, so they align from row to row; the
 * exact counts in the cell's title and as its screen-reader text (the header names the order the same way).
 */
export function VotingCell({ voting }: { voting: V2Holder["voting_authority"] }) {
    if (!voting) return <span>—</span>;

    const exact = votingText(voting);

    return (
        <div className="grid grid-cols-[repeat(3,3rem)] justify-end gap-x-1 text-right tabular-nums" title={exact}>
            <span className="sr-only">{exact}</span>
            <span aria-hidden>{compactCount(voting.sole)}</span>
            <span aria-hidden>{compactCount(voting.shared)}</span>
            <span aria-hidden>{compactCount(voting.none)}</span>
        </div>
    );
}

const VOTING: ColumnDef<V2Holder> = {
    cell: ({ row }) => <VotingCell voting={row.original.voting_authority} />,
    header: () => (
        <div className="grid grid-cols-[repeat(3,3rem)] justify-end gap-x-1 text-right" title={VOTING_ORDER}>
            <span className="sr-only">Voting authority (sole, shared, none)</span>
            <span aria-hidden>Sole</span>
            <span aria-hidden>Shared</span>
            <span aria-hidden>None</span>
        </div>
    ),
    id: "voting_authority",
};

/** The filing's EDGAR index page (13F, N-PORT); an issuer file has none. */
export function FilingLink({ url }: { url: null | string | undefined }) {
    // Only an EDGAR page is linked (the URL comes from the API; never a script or another host).
    if (!url?.startsWith("https://www.sec.gov/")) return <span>—</span>;

    return (
        <a className="text-primary underline-offset-4 hover:underline" href={url} rel="noopener noreferrer" target="_blank" title="The filing on SEC EDGAR">
            EDGAR
        </a>
    );
}

const FILING: ColumnDef<V2Holder> = { cell: ({ row }) => <FilingLink url={row.original.filing_url} />, header: "Filing", id: "filing_url" };

/**
 * The columns of one source, the holder first (pinned while the table is cut): 13F has no fund weight or tickers; an
 * issuer file has no filing.
 */
export const HOLDER_COLUMNS: Record<V2HolderSource, Array<ColumnDef<V2Holder>>> = {
    "13f": [HOLDER, AS_OF, FILED, SHARES, SHARES_TYPE, VALUE, DISCRETION, VOTING, FILING],
    "issuer_file": [HOLDER, AS_OF, TICKERS, SHARES, VALUE, WEIGHT],
    "nport": [HOLDER, AS_OF, FILED, TICKERS, SHARES, SHARES_TYPE, VALUE, WEIGHT, FILING],
};

const EMPTY_TEXT: Record<V2HolderSource, string> = {
    "13f": "No institutional holders reported for this quarter.",
    "issuer_file": "No ETF with an issuer holdings file holds this security.",
    "nport": "No fund reported this security in its latest N-PORT report.",
};

/** The scope line of the issuer-file source: never presented as complete (only ETFs with an issuer file). */
function issuerFileNote(meta: undefined | V2HoldersResponse["meta"]): string {
    const funds = meta?.funds_with_issuer_file;

    return `Daily, from the issuer holdings files of ${funds == null ? "the ETFs in scope" : `${formatNumberEn(funds)} ETFs`} — not every ETF. The Funds (N-PORT) tab lists the funds known from their N-PORT reports.`;
}

/** The full list of ONE source (`/v1/holders?symbol=&source=`), by cursor. */
export function HoldersList({ exportScope, source, state }: { exportScope?: string; source: V2HolderSource; state: ListState<V2HoldersResponse> }) {
    const meta = state.pages.at(0)?.meta;

    const reason = holderReasonText(meta?.reason);

    const note = source === "issuer_file" ? [issuerFileNote(meta), reason].filter(Boolean).join(" ") : reason;

    return (
        <SecListFrame<V2Holder>
            columns={HOLDER_COLUMNS[source]}
            emptyText={EMPTY_TEXT[source]}
            errorTitle={`Failed to load the ${HOLDER_SOURCE_LABELS[source]} holders`}
            exportConfig={exportScope ? { dataset: `holders-${source}`, scope: exportScope } : undefined}
            note={note && <div className="text-muted-foreground text-xs" data-testid="holders-note">{note}</div>}
            operationId="listHolders"
            state={state}
        />
    );
}

export const CHANGE_TYPE_LABELS: Record<V2HolderChangeType, string> = {
    added: "Added",
    new: "New position",
    reduced: "Reduced",
    sold_out: "Sold out",
    unchanged: "Unchanged",
};

/** `shares_change_pct` is a fraction (+1 = a new position, −1 = sold out). */
export function changePercentText(fraction: null | number) {
    if (fraction === null || !Number.isFinite(fraction)) return "—";

    const percent = fraction * 100;

    return `${percent > 0 ? "+" : ""}${formatNumberEn(percent, { maximumFractionDigits: 2 })}%`;
}

/** A held security: its ticker (links its page, else its issuer's filer page) and its name. */
export function HeldSecurityCell({ className = "truncate", security }: { className?: string; security: V2Holder["security"] }) {
    return (
        <div className={className}>
            <SecurityLink className="font-medium" security={security}>{security.symbol ?? security.name ?? "—"}</SecurityLink>
            {security.symbol && security.name && <span className="text-muted-foreground">{` · ${security.name}`}</span>}
        </div>
    );
}

/** The other side of a change: the manager (a security's holders) or the security (a manager's positions). */
const CHANGE_SUBJECT_COLUMNS: Record<"holder" | "security", ColumnDef<V2HolderChange>> = {
    holder: { cell: ({ row }) => <HolderCell holder={row.original.holder} />, header: "Institution", id: "holder" },
    security: {
        cell: ({ row }) => <HeldSecurityCell security={row.original.security} />,
        header: "Security",
        id: "security",
    },
};

/**
 * The columns of a change list; `subject` = who / what the row names besides the change. The subject comes first: it is
 * the column a wide table pins while it scrolls sideways; the quarter's dates (the same on most rows) close the row.
 */
function changeColumns(subject: "holder" | "security"): Array<ColumnDef<V2HolderChange>> {
    return [
        CHANGE_SUBJECT_COLUMNS[subject],
        { cell: ({ row }) => CHANGE_TYPE_LABELS[row.original.type], header: "Type", id: "type" },
        ...CHANGE_VALUE_COLUMNS,
        { cell: ({ row }) => day(row.original.as_of), header: "Period end", id: "as_of" },
        { cell: ({ row }) => day(row.original.prior_as_of), header: "Compared with", id: "prior_as_of" },
        { cell: ({ row }) => day(row.original.filing_date), header: "Filed", id: "filing_date" },
    ];
}

const CHANGE_VALUE_COLUMNS: Array<ColumnDef<V2HolderChange>> = [
    {
        cell: ({ row }) => right(money(row.original.value_change_usd)),
        header: () => <div className="text-right">Change $</div>,
        id: "value_change_usd",
    },
    {
        cell: ({ row }) => right(count(row.original.shares_change)),
        header: () => <div className="text-right">Change shares</div>,
        id: "shares_change",
    },
    {
        cell: ({ row }) => right(changePercentText(row.original.shares_change_pct)),
        header: () => <div className="text-right">Change %</div>,
        id: "shares_change_pct",
    },
    {
        cell: ({ row }) => right(count(row.original.shares)),
        header: () => <div className="text-right">New position</div>,
        id: "shares",
    },
    {
        cell: ({ row }) => right(count(row.original.shares_prior)),
        header: () => <div className="text-right">Old position</div>,
        id: "shares_prior",
    },
    {
        cell: ({ row }) => right(money(row.original.value_usd)),
        header: () => <div className="text-right">Value</div>,
        id: "value_usd",
    },
    {
        cell: ({ row }) => sharesTypeText(row.original),
        header: "Unit",
        id: "shares_type",
    },
];

const HOLDER_CHANGE_COLUMNS = changeColumns("holder");

const FILER_CHANGE_COLUMNS = changeColumns("security");

/**
 * 13F position changes vs the prior quarter: a security's holders (`/v1/holder-changes`, `subject` holder) or one
 * manager's positions (`/v1/filers/{cik}/holding-changes`, `subject` security).
 */
export function HolderChangesList({
    exportScope,
    state,
    subject = "holder",
}: {
    exportScope?: string;
    state: ListState<V2FilerHoldingChangesResponse | V2HolderChangesResponse>;
    subject?: "holder" | "security";
}) {
    return (
        <SecListFrame<V2HolderChange>
            columns={subject === "holder" ? HOLDER_CHANGE_COLUMNS : FILER_CHANGE_COLUMNS}
            emptyText="No position changes for these filters."
            errorTitle="Failed to load the 13F changes"
            exportConfig={exportScope ? { dataset: subject === "holder" ? "holder-changes" : "position-changes", scope: exportScope } : undefined}
            operationId={subject === "holder" ? "listHolderChanges" : "listFilerHoldingChanges"}
            state={state}
        />
    );
}

/** "12 shown of 774", "25 shown, more available", "3 holders". */
export function sectionCountText(section: V2HolderSection): string {
    if (section.total != null && section.total > section.rows) return `${formatNumberEn(section.rows)} shown of ${formatNumberEn(section.total)}`;

    if (section.has_more) return `${formatNumberEn(section.rows)} shown, more available`;

    return `${formatNumberEn(section.rows)} ${section.rows === 1 ? "holder" : "holders"}`;
}

/**
 * One source of the overview (a `Section`): the source as its title, the state badge, as-of and count as its meta line,
 * the source note and reason, "Show all" as its action, then the top rows.
 */
function HolderSectionView({ onShowAll, rows, section }: { onShowAll: (source: V2HolderSource) => void; rows: Array<V2Holder>; section: V2HolderSection }) {
    const reason = holderReasonText(section.reason);

    return (
        <div data-testid={`holders-section-${section.source}`}>
            <Section
                actions={section.has_more && (
                    <Button onClick={() => onShowAll(section.source)} size="sm" type="button" variant="outline">
                        Show all
                    </Button>
                )}
                description={(
                    <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <Badge variant={section.state === "complete" ? "secondary" : "outline"}>{HOLDER_SECTION_STATE_LABELS[section.state]}</Badge>
                            {section.as_of && <span>{`as of ${formatDay(section.as_of)}`}</span>}
                            <span className="tabular-nums">{sectionCountText(section)}</span>
                        </div>
                        <div>{HOLDER_SOURCE_NOTES[section.source]}</div>
                        {reason && <div>{reason}</div>}
                    </div>
                )}
                title={HOLDER_SOURCE_LABELS[section.source]}
            >
                {rows.length > 0 && (
                    <DataTable
                        columns={HOLDER_COLUMNS[section.source]}
                        emptyIsGenuine={false}
                        emptyText=""
                        isLoading={false}
                        rows={rows}
                    />
                )}
            </Section>
        </div>
    );
}

/**
 * The overview (`/v1/holders?symbol=` without `source`, owner decision 12): one block per `meta.sections[]` entry in
 * the API's order, each with its own state, as-of and count — never one merged list. "Show all" opens that source's
 * full list (`onShowAll`).
 */
export function HoldersOverview({ onShowAll, state }: { onShowAll: (source: V2HolderSource) => void; state: ListState<V2HoldersResponse> }) {
    const { error, isLoading, pages } = state;

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the holders" />;

    // Shaped like a source's section: title, meta line, table.
    if (isLoading && pages.length === 0) {
        return (
            <div aria-busy className="flex flex-col gap-3" data-testid="holders-overview-loading">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    const page = pages.at(0);

    if (!page) return null;

    const sections = page.meta.sections ?? [];

    return (
        <div className="flex flex-col gap-8" data-testid="holders-overview">
            <V2MetaLine meta={{ pinned_at: page.meta.pinned_at }} />
            {sections.map(section => (
                <HolderSectionView
                    key={section.source}
                    onShowAll={onShowAll}
                    rows={page.data.filter(row => row.source === section.source)}
                    section={section}
                />
            ))}
        </div>
    );
}
