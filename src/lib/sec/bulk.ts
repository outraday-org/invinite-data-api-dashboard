import type { FieldErrors } from "@/lib/alerts/alert-form";
import type { StatusTone } from "@/lib/alerts/labels";
import type { BulkFilesQuery } from "@/lib/api/bulk-requests";
import type { OperationId } from "@/lib/api/operations.gen";
import type { KeyState } from "@/lib/api/queries";
import type {
    BulkDownload,
    BulkExport,
    BulkExportDataset,
    BulkExportDateField,
    BulkExportFormat,
    BulkExportStatus,
    BulkFile,
    BulkFileDataset,
    BulkFileFormat,
    BulkFileKind,
    CreateBulkExportRequest,
    V2Me,
} from "@/lib/api/types";

import { problemFieldErrors } from "@/lib/alerts/alert-form";
import { ApiRequestError, errorDescription } from "@/lib/api/errors";
import { OPERATIONS } from "@/lib/api/operations.gen";
import { planAllows } from "@/lib/api/request-meta";
import { MAX_COMPANIES } from "@/lib/company-list";
import { formatDay } from "@/lib/format";
import { parseCikList } from "@/lib/sec/ownership";
import { orderedWindow } from "@/lib/url-state";

/**
 * The pure rules of `/sec/datasets` "SEC bulk data" (Data API 12.2, backend tasks/sec-bulk-downloads task 8): the tabs,
 * the Files filters ↔ URL ↔ `GET /v1/bulk/files`, the words of every contract enum, the company export form →
 * `POST /v1/bulk/exports`, a refusal in words, and the signed download URL taken out of its answer.
 */

// ── Tabs ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** `?tab=` (absent = Files). */
export const BULK_TABS = ["files", "exports", "releases"] as const;

export type BulkTab = (typeof BULK_TABS)[number];

export const BULK_TAB_LABELS: Record<BulkTab, string> = { exports: "Company exports", files: "Files", releases: "Releases" };

/**
 * The plan gate of a tab (every bulk operation and `listDatasets` are Enterprise): `checking` while the key gate waits
 * for `/v1/me` (nothing is asked yet), `refused` when the known plan lacks the operation (the notice, no request),
 * else `allowed` — also when `/v1/me` failed (the API's own answer then decides, shown as a state).
 */
export function bulkPlanGate(key: { me: null | Pick<V2Me, "plan">; state: KeyState }, operationId: OperationId): "allowed" | "checking" | "refused" {
    if (key.state === "checking") return "checking";

    if (key.me && !planAllows(key.me.plan, OPERATIONS[operationId].tier)) return "refused";

    return "allowed";
}

// ── Words of the contract's enums ────────────────────────────────────────────────────────────────────────────────

/** The eight SEC data sets of `GET /v1/bulk/files` (`BulkFile.dataset`). */
export const BULK_FILE_DATASETS = ["f13", "f345", "formd", "fsn", "icsc", "ncen", "nport", "rr"] as const satisfies ReadonlyArray<BulkFileDataset>;

/** The four parsed data sets a company export reads (`CreateBulkExportRequest.dataset`). */
export const BULK_EXPORT_DATASETS = ["f13", "f345", "formd", "nport"] as const satisfies ReadonlyArray<BulkExportDataset>;

export const BULK_KINDS = ["parsed", "raw"] as const satisfies ReadonlyArray<BulkFileKind>;

export const KIND_LABELS: Record<BulkFileKind, string> = { parsed: "Parsed", raw: "Raw SEC file" };

/** Every format of `BulkFile.format` (the `?format=` values). */
export const BULK_FILE_FORMATS = ["zip", "csv", "csv_gz", "parquet"] as const satisfies ReadonlyArray<BulkFileFormat>;

export const FORMAT_LABELS: Record<BulkFileFormat, string> = { csv: "CSV", csv_gz: "CSV.gz", parquet: "Parquet", zip: "Zip" };

/** The formats of a kind: parsed files are `csv_gz` / `parquet`, raw files the SEC's `zip` (`icsc`: a bare `csv`). */
export const FORMATS_BY_KIND: Record<BulkFileKind, ReadonlyArray<BulkFileFormat>> = { parsed: ["csv_gz", "parquet"], raw: ["zip", "csv"] };

/** The Format picker's choices: the kind's formats, or all four without a kind. */
export function formatsOf(kind: BulkFileKind | undefined): ReadonlyArray<BulkFileFormat> {
    return kind ? FORMATS_BY_KIND[kind] : [...FORMATS_BY_KIND.parsed, ...FORMATS_BY_KIND.raw];
}

export const BULK_EXPORT_FORMATS = ["csv_gz", "parquet"] as const satisfies ReadonlyArray<BulkExportFormat>;

export const DATE_FIELD_LABELS: Record<BulkExportDateField, string> = {
    filed_date: "Filed date",
    first_sale_date: "First sale date",
    period_of_report: "Period of report",
    report_date: "Report date",
    transaction_date: "Transaction date",
};

/** The dates a data set's range may apply to (backend task 4 §2); the first is the API's default (`filed_date`). */
export const DATE_FIELDS_BY_DATASET: Record<BulkExportDataset, ReadonlyArray<BulkExportDateField>> = {
    f13: ["filed_date", "period_of_report"],
    f345: ["filed_date", "transaction_date"],
    formd: ["filed_date", "first_sale_date"],
    nport: ["filed_date", "report_date"],
};

/** Whether a data set takes a filer list (`filer` is not available for Form D). */
export const takesFilers = (dataset: BulkExportDataset) => dataset !== "formd";

/** What a filer CIK means per data set (the field's help). */
export const FILER_MEANING: Record<Exclude<BulkExportDataset, "formd">, string> = {
    f13: "the 13F manager",
    f345: "any reporting owner",
    nport: "the fund registrant",
};

export const EXPORT_STATUS_INFO: Record<BulkExportStatus, { label: string; meaning: string; tone: StatusTone }> = {
    expired: { label: "Expired", meaning: "Its file was deleted (7 days after it finished); create the export again.", tone: "outline" },
    failed: { label: "Failed", meaning: "The export failed and has no file; its error code says why.", tone: "destructive" },
    queued: { label: "Queued", meaning: "Waiting for a worker; this list refreshes every 5 seconds.", tone: "secondary" },
    ready: { label: "Ready", meaning: "The file is ready to download until it expires.", tone: "default" },
    running: { label: "Running", meaning: "Being written; this list refreshes every 5 seconds.", tone: "secondary" },
};

/** An export still to settle (the list and its detail refresh every 5 s while one is shown). */
export const isOpenExport = (row: Pick<BulkExport, "status">) => row.status === "queued" || row.status === "running";

/** A ready export whose file is not past its expiry (the hourly sweep may not have marked it `expired` yet). */
export function isExportDownloadable(row: Pick<BulkExport, "expires_at" | "status">, now: Date = new Date()) {
    return row.status === "ready" && (row.expires_at === null || new Date(row.expires_at).getTime() > now.getTime());
}

/** The sentence of an N-PORT export's narrower scope (`coverage.scope` set; shown in the form too). */
export const NPORT_EXPORT_SCOPE_TEXT = "N-PORT exports cover listed funds in full and unlisted funds as holders only (equity and fund shares). The period files on the Files tab hold every fund.";

/** The sentences under an export's row: why its range was cut and an N-PORT export's scope. */
export function exportCoverageNotes(row: Pick<BulkExport, "coverage" | "dataset">): Array<string> {
    const notes: Array<string> = [];

    const reason = row.coverage?.reason;

    if (reason === "before_postgres_window") notes.push("Older periods are available as raw SEC zips on the Files tab.");
    else if (reason === "capped_window") notes.push("The range was cut: a period date range reads the releases filed up to one year after its end.");
    else if (reason) notes.push(`The range was cut (${reason}).`);

    if (row.coverage?.scope) notes.push(NPORT_EXPORT_SCOPE_TEXT);

    return notes;
}

/** "2026q3 · Jul 1 – Sep 30, 2026" (the period key alone without coverage days). */
export function periodText(file: Pick<BulkFile, "coverage_end" | "coverage_start" | "period_key">) {
    if (!file.coverage_start || !file.coverage_end) return file.period_key;

    return `${file.period_key} · ${formatDay(file.coverage_start)} – ${formatDay(file.coverage_end)}`;
}

/** "Parsed · CSV.gz". */
export const kindFormatText = (file: Pick<BulkFile, "format" | "kind">) => `${KIND_LABELS[file.kind]} · ${FORMAT_LABELS[file.format]}`;

// ── Files filters (URL state) ────────────────────────────────────────────────────────────────────────────────────

/** `?dataset=&kind=&format=&from=&to=&superseded=true` of the Files tab. */
export type BulkFilesSearch = {
    dataset?: BulkFileDataset;
    format?: BulkFileFormat;
    from?: string;
    kind?: BulkFileKind;
    superseded?: boolean;
    to?: string;
};

/** The request of the Files filters (the cursor is the hook's page param, never a filter; a reversed range in order). */
export function bulkFilesQuery(search: BulkFilesSearch): Omit<BulkFilesQuery, "cursor" | "limit"> {
    const released = orderedWindow({ from: search.from, to: search.to });

    return {
        dataset: search.dataset,
        format: search.format && formatsOf(search.kind).includes(search.format) ? search.format : undefined,
        includeSuperseded: search.superseded === true ? true : undefined,
        kind: search.kind,
        releasedFrom: released.from,
        releasedTo: released.to,
    };
}

/** The filters set (the release day range counts once): the bar's "Reset filters" count. */
export const bulkFilesFilterCount = (search: BulkFilesSearch) =>
    [search.dataset, search.kind, search.format, search.from ?? search.to, search.superseded].filter(Boolean).length;

/** A changed kind keeps the format only when the new kind has it (raw `zip` never stays under "Parsed"). */
export function kindPatch(search: BulkFilesSearch, kind: BulkFileKind | undefined): Pick<BulkFilesSearch, "format" | "kind"> {
    return { format: search.format && formatsOf(kind).includes(search.format) ? search.format : undefined, kind };
}

/** The URL patch that clears every Files filter. */
export const CLEAR_FILES_FILTERS: BulkFilesSearch = { dataset: undefined, format: undefined, from: undefined, kind: undefined, superseded: undefined, to: undefined };

// ── Company export form ──────────────────────────────────────────────────────────────────────────────────────────

/** The form as typed: companies as picked (tickers / CIKs), filer CIKs as text, days as `YYYY-MM-DD`. */
export type BulkExportFormState = {
    company: Array<string>;
    dataset: BulkExportDataset;
    dateField: BulkExportDateField;
    filer: string;
    format: BulkExportFormat;
    from: string;
    to: string;
};

export const emptyBulkExportForm = (): BulkExportFormState => ({ company: [], dataset: "f13", dateField: "filed_date", filer: "", format: "csv_gz", from: "", to: "" });

/** A changed data set keeps the date field only when the new set has it (else `filed_date`, every set's default). */
export function withDataset(state: BulkExportFormState, dataset: BulkExportDataset): BulkExportFormState {
    return { ...state, dataset, dateField: DATE_FIELDS_BY_DATASET[dataset].includes(state.dateField) ? state.dateField : "filed_date" };
}

/** At most 3,660 days from `from` to `to` (the API's bound). */
export const MAX_EXPORT_DAYS = 3660;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

/**
 * The form → the create body (pure), with the errors the API would answer (the same field keys as a 400's `param`):
 * a range from ≤ to, ≤ 3,660 days, at least one company or filer CIK, no filer for Form D.
 */
export function toCreateBulkExportBody(state: BulkExportFormState): { body: CreateBulkExportRequest; errors: FieldErrors } {
    const errors: FieldErrors = {};

    const filers = takesFilers(state.dataset) ? (parseCikList(state.filer) ?? []) : [];

    if (takesFilers(state.dataset) && state.filer.trim() !== "" && filers.length === 0) errors.filer = "No CIK in this list (digits only).";

    if (state.company.length === 0 && filers.length === 0 && !errors.filer) errors.company = "Pick at least one company or enter a filer CIK.";
    else if (state.company.length > MAX_COMPANIES) errors.company = `At most ${MAX_COMPANIES} companies.`;

    if (!DAY.test(state.from) || Number.isNaN(dayNumber(state.from))) errors.from = "Pick the first day of the range.";

    if (!DAY.test(state.to) || Number.isNaN(dayNumber(state.to))) errors.to = "Pick the last day of the range.";
    else if (!errors.from) {
        const days = dayNumber(state.to) - dayNumber(state.from);

        if (days < 0) errors.to = "The last day is before the first day.";
        else if (days > MAX_EXPORT_DAYS) errors.to = `At most ${MAX_EXPORT_DAYS.toLocaleString("en-US")} days.`;
    }

    const body: CreateBulkExportRequest = {
        dataset: state.dataset,
        date_field: state.dateField,
        format: state.format,
        from: state.from,
        to: state.to,
        ...(state.company.length > 0 ? { company: state.company } : {}),
        ...(filers.length > 0 ? { filer: filers } : {}),
    };

    return { body, errors };
}

const FORM_FIELDS = new Set(["company", "dataset", "date_field", "filer", "format", "from", "to"]);

/** A 400's `param` → the form field (`company[3]` → `company`, `date_field`, …); anything else is the form's. */
export function bulkExportFieldKeyOf(param: null | string | undefined): null | string {
    if (!param) return null;

    const top = param.replace(/\[\d+\]$/, "");

    return FORM_FIELDS.has(top) ? top : null;
}

/** A refused create's problems on the form's fields (`param` and every `errors[]` entry), the rest under `form`. */
export const bulkExportFieldErrorsOf = (error: ApiRequestError): FieldErrors => problemFieldErrors(error, bulkExportFieldKeyOf);

// ── Refusals and the download URL ────────────────────────────────────────────────────────────────────────────────

/** "4 h 12 min" until the next 00:00 UTC (the daily caps' reset). */
export function untilUtcMidnight(now: Date): string {
    const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);

    const minutes = Math.max(1, Math.ceil((midnight - now.getTime()) / 60_000));

    const hours = Math.floor(minutes / 60);

    return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

/**
 * A refused download or create in words (the toast's description): a 429 of a daily cap names the cap (the API's
 * detail) and when it resets (00:00 UTC); the open-exports 429 and every other refusal say the API's detail with its
 * code and request id (`errorDescription`).
 */
export function bulkRefusalText(error: unknown, now: Date = new Date()): string {
    if (!(error instanceof ApiRequestError)) return error instanceof Error ? error.message : "The request failed.";

    if (error.status === 429 && /daily/i.test(error.message)) {
        return `${error.message.replace(/\.$/, "")}. It resets at 00:00 UTC, in ${untilUtcMidnight(now)}.`;
    }

    return errorDescription(error);
}

/**
 * Takes the signed `url` out of a download answer (in place, like the destination secret's `takeSecret`): the answer
 * the mutation keeps no longer carries it, so neither the cache nor the request panel can show it.
 */
export function takeDownloadUrl(answer: BulkDownload): null | string {
    const url = typeof answer.url === "string" ? answer.url : null;

    delete (answer as Partial<BulkDownload>).url;

    return url;
}
