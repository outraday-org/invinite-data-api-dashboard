import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import * as React from "react";

import type { FieldErrors } from "@/lib/alerts/alert-form";
import type { BulkExport, BulkExportDataset, BulkExportDateField, BulkExportFormat, BulkExportsResponse } from "@/lib/api/types";
import type { BulkExportFormState } from "@/lib/sec/bulk";

import { FieldShell } from "@/components/alerts/alert-form-view";
import { CompanyFilter } from "@/components/search/company-filter";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { DataTable } from "@/components/ui/data-table";
import { DayRange } from "@/components/ui/day-range";
import { FilterSelect } from "@/components/ui/filter-select";
import { Section } from "@/components/ui/section";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import { StatusBadge } from "@/components/ui/status-badge";
import { TokenInput } from "@/components/ui/token-input";
import { formatBytes } from "@/lib/earnings/format";
import { DASH, formatDay, formatDayTimeShort, formatNumber } from "@/lib/format";
import {
    BULK_EXPORT_DATASETS,
    BULK_EXPORT_FORMATS,
    DATE_FIELD_LABELS,
    DATE_FIELDS_BY_DATASET,
    EXPORT_STATUS_INFO,
    exportCoverageNotes,
    FILER_MEANING,
    FORMAT_LABELS,
    isExportDownloadable,
    NPORT_EXPORT_SCOPE_TEXT,
    takesFilers,
    withDataset,
} from "@/lib/sec/bulk";
import { DATASET_LABELS } from "@/lib/sec/datasets";
import { ignoredCikTokens } from "@/lib/sec/ownership";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";

import { BulkDownloadButton } from "./bulk-download-button";

/** What the company list means per data set (the field's help). */
const COMPANY_MEANING: Record<BulkExportDataset, string> = {
    f13: "13F holdings of these issuers",
    f345: "the insider filings of these issuers",
    formd: "the Form D offerings of these issuers",
    nport: "N-PORT holdings of these issuers",
};

const DATASET_OPTIONS: Array<{ label: string; value: BulkExportDataset }> = BULK_EXPORT_DATASETS.map(dataset => ({ label: DATASET_LABELS[dataset] ?? dataset, value: dataset }));

const FORMAT_OPTIONS: Array<{ label: string; title: string; value: BulkExportFormat }> = BULK_EXPORT_FORMATS.map(format => ({
    label: FORMAT_LABELS[format],
    title: format === "parquet" ? "Typed columns, for data frames and warehouses" : "Gzip-compressed CSV",
    value: format,
}));

const fieldId = (key: string) => `bulk-export-${key.replace("_", "-")}`;

/**
 * The company export form (pure): data set, companies (issuers, ≤ 50), filer CIKs (digits only; not for Form D), the
 * date the range applies to (per data set), the range, the format. `errors` = the form's own checks or a 400's
 * `param` / `errors[]` on their fields (`bulkExportFieldErrorsOf`); `form` = what names no field.
 */
export function BulkExportForm({
    errors,
    isPending,
    onChange,
    onSubmit,
    state,
}: {
    errors: FieldErrors;
    isPending: boolean;
    onChange: (next: BulkExportFormState) => void;
    onSubmit: () => void;
    state: BulkExportFormState;
}) {
    const dateFieldOptions: Array<{ label: string; value: BulkExportDateField }> = DATE_FIELDS_BY_DATASET[state.dataset].map(field => ({ label: DATE_FIELD_LABELS[field], value: field }));

    const ignored = ignoredCikTokens(state.filer);

    const filers = takesFilers(state.dataset);

    return (
        <form
            aria-label="Create a company export"
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();

                onSubmit();
            }}
        >
            <div className="grid gap-4 md:grid-cols-2">
                <FieldShell error={errors.dataset} htmlFor={fieldId("dataset")} label="Data set">
                    <FilterSelect aria-label="Data set" className="w-full" id={fieldId("dataset")} onValueChange={value => onChange(withDataset(state, value))} options={DATASET_OPTIONS} value={state.dataset} />
                </FieldShell>
                <FieldShell error={errors.format} label="Format">
                    <SegmentedButtons aria-label="Format" onChange={value => onChange({ ...state, format: value })} options={FORMAT_OPTIONS} value={state.format} />
                </FieldShell>
                <FieldShell error={errors.company} help={`Tickers or CIKs, up to 50: ${COMPANY_MEANING[state.dataset]}.`} htmlFor={fieldId("company")} label="Companies">
                    <CompanyFilter id={fieldId("company")} onChange={company => onChange({ ...state, company })} placeholder="Pick companies" value={state.company} />
                </FieldShell>
                {filers
                    ? (
                            <FieldShell
                                error={errors.filer}
                                help={ignored.length > 0 ? `Ignored (no CIK): ${ignored.join(", ")}` : `CIKs only, up to 50: ${FILER_MEANING[state.dataset as Exclude<BulkExportDataset, "formd">]}.`}
                                htmlFor={fieldId("filer")}
                                label="Filer CIKs"
                            >
                                <TokenInput aria-invalid={Boolean(errors.filer)} aria-label="Filer CIKs" id={fieldId("filer")} onChange={filer => onChange({ ...state, filer })} placeholder="e.g. 102909" value={state.filer} />
                            </FieldShell>
                        )
                    : (
                            <FieldShell label="Filer CIKs">
                                <p className="text-muted-foreground text-sm">A Form D export takes companies only.</p>
                            </FieldShell>
                        )}
                <FieldShell error={errors.date_field} help="The date the range applies to." htmlFor={fieldId("date_field")} label="Date field">
                    <FilterSelect aria-label="Date field" className="w-full" id={fieldId("date_field")} onValueChange={value => onChange({ ...state, dateField: value })} options={dateFieldOptions} value={state.dateField} />
                </FieldShell>
                <FieldShell error={[errors.from, errors.to].filter(Boolean).join(" ") || undefined} help="Both days inclusive, at most 3,660 days." label="Range">
                    <DayRange from={state.from || undefined} labels={{ from: "From", to: "To" }} onChange={patch => onChange({ ...state, ...("from" in patch ? { from: patch.from ?? "" } : { to: patch.to ?? "" }) })} to={state.to || undefined} />
                </FieldShell>
            </div>

            {state.dataset === "nport" && <p className="text-muted-foreground text-sm" data-testid="nport-scope-note">{NPORT_EXPORT_SCOPE_TEXT}</p>}

            {errors.form && <p className="text-destructive text-sm" role="alert">{errors.form}</p>}

            <div>
                <Button disabled={isPending} type="submit">{isPending ? "Creating…" : "Create export"}</Button>
            </div>
        </form>
    );
}

/** A CIK as typed by a person (no padding) for `/sec/$cik`. */
const plainCik = (cik: string) => String(Number(cik));

/** At most `max` CIK links, then "+N". */
function CikLinks({ ciks, label, max = 3 }: { ciks: ReadonlyArray<string>; label: string; max?: number }) {
    if (ciks.length === 0) return null;

    const shown = ciks.slice(0, max);

    return (
        <span className="text-xs">
            <span className="text-muted-foreground">{`${label}: `}</span>
            {shown.map((cik, index) => (
                <React.Fragment key={cik}>
                    {index > 0 && ", "}
                    <Link className="underline-offset-4 hover:underline" params={{ cik: plainCik(cik) }} to="/sec/$cik">{plainCik(cik)}</Link>
                </React.Fragment>
            ))}
            {ciks.length > max && ` +${ciks.length - max}`}
        </span>
    );
}

/** "Filed date · Jan 1, 2026 – Jun 30, 2026". */
const rangeText = (row: Pick<BulkExport, "date_field" | "from" | "to">) => `${DATE_FIELD_LABELS[row.date_field]} · ${formatDay(row.from)} – ${formatDay(row.to)}`;

function ExportStatus({ row }: { row: BulkExport }) {
    const info = EXPORT_STATUS_INFO[row.status];

    return <StatusBadge label={info.label} reason={row.status === "failed" ? row.error_code : null} tone={info.tone} tooltip={info.meaning} />;
}

function ExportDownload({ row }: { row: BulkExport }) {
    return isExportDownloadable(row) ? <BulkDownloadButton filename={row.filename} target={{ exportId: row.export_id, kind: "export" }} /> : <span className="text-muted-foreground">{DASH}</span>;
}

function exportColumns(onOpen: (exportId: string) => void): Array<ColumnDef<BulkExport>> {
    return [
        {
            cell: ({ row }) => (
                <button className="text-left tabular-nums underline-offset-4 hover:underline" onClick={() => onOpen(row.original.export_id)} title={`Details of ${row.original.export_id}`} type="button">
                    {formatDayTimeShort(row.original.created_at)}
                </button>
            ),
            header: "Created",
            id: "created_at",
        },
        {
            cell: ({ row }) => (
                <div className="flex max-w-80 flex-col gap-0.5">
                    <span className="font-medium">{DATASET_LABELS[row.original.dataset] ?? row.original.dataset}</span>
                    <span className="text-muted-foreground text-xs">{`${row.original.dataset} · ${FORMAT_LABELS[row.original.format]}`}</span>
                    {exportCoverageNotes(row.original).map(note => <span className="text-muted-foreground text-xs" key={note}>{note}</span>)}
                </div>
            ),
            header: "Data set",
            id: "dataset",
        },
        {
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <CikLinks ciks={row.original.company_ciks} label="Companies" />
                    <CikLinks ciks={row.original.filer_ciks} label="Filers" />
                </div>
            ),
            header: "Subjects",
            id: "subjects",
        },
        { cell: ({ row }) => <span className="tabular-nums">{rangeText(row.original)}</span>, header: "Date range", id: "range" },
        { cell: ({ row }) => <ExportStatus row={row.original} />, header: "Status", id: "status" },
        { cell: ({ row }) => <span className="tabular-nums">{row.original.row_count === null ? DASH : formatNumber(row.original.row_count)}</span>, header: "Rows", id: "rows" },
        { cell: ({ row }) => <span className="tabular-nums">{formatBytes(row.original.bytes)}</span>, header: "Size", id: "bytes" },
        { cell: ({ row }) => <span className="tabular-nums">{row.original.expires_at ? formatDayTimeShort(row.original.expires_at) : DASH}</span>, header: "Expires", id: "expires_at" },
        { cell: ({ row }) => <ExportDownload row={row.original} />, header: "", id: "download" },
    ];
}

/**
 * The account's company exports (pure but for the Download buttons' writes), newest first: Created (opens the
 * `?export=` detail), Data set (with the coverage and N-PORT sentences under it), Subjects, Date range, Status (with
 * its meaning), Rows, Size, Expires and Download while `ready` and not expired.
 */
export function BulkExportsView({
    error,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onLoadMore,
    onOpen,
    pages,
}: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    onOpen: (exportId: string) => void;
    pages: ReadonlyArray<BulkExportsResponse>;
}) {
    const columns = React.useMemo(() => exportColumns(onOpen), [onOpen]);

    if (error && pages.length === 0) return <SecReadinessNotice error={error} operationId="listBulkExports" title="Failed to load the company exports" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={meta?.coverage} />
            <DataTable
                columns={columns}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No company export yet: create one above."
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listBulkExports"
                rows={pages.flatMap(page => page.data)}
            />
        </div>
    );
}

function DetailRow({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className="grid grid-cols-1 gap-0.5 border-b py-2 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{children}</dd>
        </div>
    );
}

const cikList = (ciks: ReadonlyArray<string>) => (ciks.length > 0 ? ciks.map(plainCik).join(", ") : DASH);

/** One export in full (`GET /v1/bulk/exports/{export_id}`, the `?export=` detail): every field, coverage, Download. */
export function BulkExportDetail({ error, onClose, row }: { error: unknown; onClose: () => void; row: BulkExport | null }) {
    const close = (
        <Button aria-label="Close the export" onClick={onClose} size="icon-sm" type="button" variant="ghost">
            <XIcon />
        </Button>
    );

    if (!row) {
        return (
            <Section actions={close} aria-label="Company export" title="Company export">
                {error ? <SecReadinessNotice error={error} operationId="getBulkExport" title="Failed to load the export" /> : <p className="text-muted-foreground text-sm">Loading…</p>}
            </Section>
        );
    }

    const coverage = row.coverage;

    return (
        <Section
            actions={(
                <div className="flex items-center gap-2">
                    <ExportDownload row={row} />
                    {close}
                </div>
            )}
            aria-label="Company export"
            description={exportCoverageNotes(row).join(" ") || undefined}
            title={`${DATASET_LABELS[row.dataset] ?? row.dataset} export`}
        >
            <dl className="text-sm">
                <DetailRow label="Export id">
                    <span className="inline-flex items-center gap-1 font-mono text-xs">
                        {row.export_id}
                        <CopyButton label="Copy the export id" value={row.export_id} />
                    </span>
                </DetailRow>
                <DetailRow label="Status"><ExportStatus row={row} /></DetailRow>
                {row.error_code && <DetailRow label="Error code">{row.error_code}</DetailRow>}
                <DetailRow label="Companies">{cikList(row.company_ciks)}</DetailRow>
                <DetailRow label="Filers">{cikList(row.filer_ciks)}</DetailRow>
                <DetailRow label="Range">{rangeText(row)}</DetailRow>
                <DetailRow label="Format">{FORMAT_LABELS[row.format]}</DetailRow>
                <DetailRow label="Created">{formatDayTimeShort(row.created_at)}</DetailRow>
                <DetailRow label="Started">{row.started_at ? formatDayTimeShort(row.started_at) : DASH}</DetailRow>
                <DetailRow label="Finished">{row.finished_at ? formatDayTimeShort(row.finished_at) : DASH}</DetailRow>
                <DetailRow label="Expires">{row.expires_at ? formatDayTimeShort(row.expires_at) : DASH}</DetailRow>
                <DetailRow label="File">{row.filename ?? DASH}</DetailRow>
                <DetailRow label="Rows">{row.row_count === null ? DASH : formatNumber(row.row_count)}</DetailRow>
                <DetailRow label="Size">{formatBytes(row.bytes)}</DetailRow>
                <DetailRow label="SHA-256">
                    {row.sha256
                        ? (
                                <span className="inline-flex items-center gap-1 font-mono text-xs break-all">
                                    {row.sha256}
                                    <CopyButton label="Copy the SHA-256" value={row.sha256} />
                                </span>
                            )
                        : DASH}
                </DetailRow>
                <DetailRow label="Schema">{row.schema_version ?? DASH}</DetailRow>
                <DetailRow label="Covered">
                    {coverage ? `${formatDay(coverage.from)} – ${formatDay(coverage.through)} · releases ${coverage.releases.join(", ") || DASH}` : DASH}
                </DetailRow>
            </dl>
        </Section>
    );
}
