import type { ColumnDef } from "@tanstack/react-table";

import type { BulkFile, BulkFileDataset, BulkFileFormat, BulkFileKind, BulkFilesResponse } from "@/lib/api/types";
import type { BulkFilesSearch } from "@/lib/sec/bulk";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DayRange } from "@/components/ui/day-range";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import { formatBytes } from "@/lib/earnings/format";
import { DASH, formatDay, formatNumber } from "@/lib/format";
import {
    BULK_FILE_DATASETS,
    BULK_KINDS,
    bulkFilesFilterCount,
    CLEAR_FILES_FILTERS,
    FORMAT_LABELS,
    formatsOf,
    KIND_LABELS,
    kindFormatText,
    kindPatch,
    periodText,
} from "@/lib/sec/bulk";
import { DATASET_LABELS } from "@/lib/sec/datasets";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";

import { BulkDownloadButton } from "./bulk-download-button";

const ALL = "all";

const DATASET_OPTIONS: Array<{ label: string; value: BulkFileDataset | typeof ALL }> = [
    { label: "Every data set", value: ALL },
    ...BULK_FILE_DATASETS.map(dataset => ({ label: DATASET_LABELS[dataset] ?? dataset, value: dataset })),
];

const KIND_OPTIONS: Array<{ label: string; value: BulkFileKind | typeof ALL }> = [
    { label: "Parsed and raw", value: ALL },
    ...BULK_KINDS.map(kind => ({ label: KIND_LABELS[kind], value: kind })),
];

const CURRENT = "current";

const SUPERSEDED_OPTIONS: Array<{ label: string; title: string; value: "superseded" | typeof CURRENT }> = [
    { label: "Current", title: "The current file of each release, kind and format", value: CURRENT },
    { label: "Show superseded", title: "Also the files a corrected or reloaded release replaced (they stay downloadable)", value: "superseded" },
];

const COLUMNS: Array<ColumnDef<BulkFile>> = [
    {
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="font-medium">{DATASET_LABELS[row.original.dataset] ?? row.original.dataset}</span>
                <span className="text-muted-foreground text-xs">{row.original.dataset}</span>
            </div>
        ),
        header: "Data set",
        id: "dataset",
    },
    { cell: ({ row }) => <span className="tabular-nums">{periodText(row.original)}</span>, header: "Period", id: "period" },
    {
        cell: ({ row }) => (
            <span className="flex flex-wrap items-center gap-1">
                {kindFormatText(row.original)}
                {row.original.superseded_by && <Badge title={`Replaced by ${row.original.superseded_by}`} variant="outline">Superseded</Badge>}
            </span>
        ),
        header: "Kind · format",
        id: "kind",
    },
    { cell: ({ row }) => <span className="tabular-nums">{formatBytes(row.original.bytes)}</span>, header: "Size", id: "bytes" },
    { cell: ({ row }) => <span className="tabular-nums">{row.original.row_count === null ? DASH : formatNumber(row.original.row_count)}</span>, header: "Rows", id: "rows" },
    { cell: ({ row }) => <span className="tabular-nums">{formatDay(row.original.released_at)}</span>, header: "Released", id: "released_at" },
    { cell: ({ row }) => <span className="text-muted-foreground">{row.original.schema_version ?? DASH}</span>, header: "Schema", id: "schema" },
    {
        cell: ({ row }) => <BulkDownloadButton filename={row.original.filename} target={{ fileId: row.original.file_id, kind: "file" }} />,
        header: "",
        id: "download",
    },
];

/**
 * The Files tab (pure but for the Download buttons' writes): the filters (all URL state, `onChange` gets the patch)
 * and the `GET /v1/bulk/files` rows with a Download button each. A refused list is a state; an empty genuine list
 * says "No files match these filters."
 */
export function BulkFilesView({
    error,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onChange,
    onLoadMore,
    pages,
    search,
}: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onChange: (patch: BulkFilesSearch) => void;
    onLoadMore: () => void;
    pages: ReadonlyArray<BulkFilesResponse>;
    search: BulkFilesSearch;
}) {
    const formatOptions: Array<{ label: string; value: BulkFileFormat | typeof ALL }> = [
        { label: "Every format", value: ALL },
        ...formatsOf(search.kind).map(format => ({ label: FORMAT_LABELS[format], value: format })),
    ];

    const format = search.format && formatsOf(search.kind).includes(search.format) ? search.format : ALL;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-4">
            <FilterBar activeCount={bulkFilesFilterCount(search)} onReset={() => onChange(CLEAR_FILES_FILTERS)}>
                <FilterField label="Data set" span={2}>
                    {id => <FilterSelect aria-label="Data set" className="w-full" id={id} onValueChange={value => onChange({ dataset: value === ALL ? undefined : value })} options={DATASET_OPTIONS} value={search.dataset ?? ALL} />}
                </FilterField>
                <FilterField label="Kind">
                    {id => <FilterSelect aria-label="Kind" className="w-full" id={id} onValueChange={value => onChange(kindPatch(search, value === ALL ? undefined : value))} options={KIND_OPTIONS} value={search.kind ?? ALL} />}
                </FilterField>
                <FilterField label="Format">
                    {id => <FilterSelect aria-label="Format" className="w-full" id={id} onValueChange={value => onChange({ format: value === ALL ? undefined : value })} options={formatOptions} value={format} />}
                </FilterField>
                <FilterField label="Released" span={2}>
                    <DayRange from={search.from} labels={{ from: "Released from", to: "Released to" }} onChange={onChange} to={search.to} />
                </FilterField>
                <FilterField label="Files" span={2}>
                    <SegmentedButtons aria-label="Files" onChange={value => onChange({ superseded: value === "superseded" ? true : undefined })} options={SUPERSEDED_OPTIONS} value={search.superseded ? "superseded" : CURRENT} />
                </FilterField>
            </FilterBar>

            {error && pages.length === 0
                ? <SecReadinessNotice error={error} operationId="listBulkFiles" title="Failed to load the bulk files" />
                : (
                        <div className="flex flex-col gap-2">
                            <SecReadinessNotice coverage={meta?.coverage} />
                            <DataTable
                                columns={COLUMNS}
                                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                                emptyText="No files match these filters."
                                hasNextPage={hasNextPage}
                                isFetchingNextPage={isFetchingNextPage}
                                isLoading={isLoading}
                                onLoadMore={onLoadMore}
                                operationId="listBulkFiles"
                                rows={pages.flatMap(page => page.data)}
                            />
                        </div>
                    )}
        </div>
    );
}
