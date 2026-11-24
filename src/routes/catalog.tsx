import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import type { OperationId } from "@/lib/api/operations.gen";
import type {
    StatementType,
    V2DocumentKindCatalogEntry,
    V2EventTypeCatalogEntry,
    V2FormCatalogEntry,
    V2MappingRule,
    V2MetricCatalogEntry,
    V2SectionCatalogEntry,
} from "@/lib/api/types";
import type { CatalogTab } from "@/lib/reference/catalog";

import { MacroCatalog } from "@/components/macro/macro-catalog";
import { DebouncedInput } from "@/components/navigation/debounced-input";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    useDocumentKindCatalogInfinite,
    useEventTypeCatalogInfinite,
    useFormCatalogInfinite,
    useMappingRulesInfinite,
    useMetricCatalogInfinite,
    useSectionCatalogInfinite,
} from "@/lib/api/queries";
import { useAutoLoadPages } from "@/lib/api/use-auto-load-pages";
import { formatNumber } from "@/lib/format";
import { ROW_ACTION_REVEAL_CLASS, titleHead, WRAPPING_TABS_LIST_CLASS } from "@/lib/layout";
import {
    CATALOG_TAB_LABELS,
    CATALOG_TABS,
    filterCatalogRows,
    mappingRuleView,
    STATEMENT_LABELS,
    statementLabel,
    unitLabel,
} from "@/lib/reference/catalog";
import { IN_PLACE, optionalEnum, optionalText } from "@/lib/url-state";
import { cn } from "@/lib/utils";

const STATEMENTS = ["income-statement", "balance-sheet", "cash-flow"] as const satisfies ReadonlyArray<StatementType>;

/**
 * `?tab=` (absent = metrics), `?q=` (the text filter over the loaded rows), `?statement=` (metrics, mapping rules),
 * `?form=` (sections), `?metric=` (mapping rules: one metric's rules) — the last three are API parameters.
 */
const catalogSearchSchema = z.object({
    form: z.string().trim().regex(/^[A-Z0-9][A-Z0-9 /-]{0,19}$/i).optional().catch(undefined),
    metric: z.string().trim().regex(/^[a-z0-9_]{1,120}$/).optional().catch(undefined),
    q: optionalText(120),
    statement: optionalEnum(STATEMENTS),
    tab: optionalEnum(CATALOG_TABS),
});

export type CatalogSearch = z.infer<typeof catalogSearchSchema>;

export const Route = createFileRoute("/catalog")({
    component: CatalogPage,
    head: () => titleHead("Catalog"),
    validateSearch: catalogSearchSchema,
});

const ALL = "all";

const STATEMENT_OPTIONS = [
    { label: "Every statement", value: ALL },
    ...STATEMENTS.map(statement => ({ label: STATEMENT_LABELS[statement], value: statement })),
] satisfies Array<{ label: string; value: StatementType | typeof ALL }>;

const TAB_OPTIONS = CATALOG_TABS.map(tab => ({ label: CATALOG_TAB_LABELS[tab], value: tab }));

const mono = (value: string) => <span className="font-mono text-xs">{value}</span>;

/** A name with its id below it (one column, so the tables fit the page). */
const named = (name: string, id: string) => (
    <div className="flex flex-col">
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground font-mono text-xs">{id}</span>
    </div>
);

// The Metrics table fits 1440 px with a wide description (≤ 2 lines for most rows): the name / id column is 22 rem (the
// name wraps, a long id is cut with its full text in the tooltip — the filter and the export still hold it) and the unit
// sits under the statement.
const METRIC_COLUMNS: Array<ColumnDef<V2MetricCatalogEntry>> = [
    {
        cell: ({ row }) => (
            <div className="flex w-[22rem] flex-col whitespace-normal">
                <span className="font-medium">{row.original.name}</span>
                <span className="text-muted-foreground truncate font-mono text-xs" title={row.original.metric_id}>{row.original.metric_id}</span>
            </div>
        ),
        header: "Metric",
        id: "name",
    },
    {
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span>{statementLabel(row.original.statement)}</span>
                <span className="text-muted-foreground text-xs">{unitLabel(row.original.unit)}</span>
            </div>
        ),
        header: "Statement · unit",
        id: "statement",
    },
    // ≥ 28 rem wide, so a description wraps to at most two lines at 1440 px.
    { cell: ({ row }) => <div className="text-muted-foreground min-w-[28rem] whitespace-normal">{row.original.description ?? "—"}</div>, header: "Description", id: "description" },
    {
        // Only a statement metric has mapping rules (the derived ones are computed from statement metrics); a quiet
        // row action, shown on the row's hover / focus where the pointer can hover.
        cell: ({ row }) => (row.original.statement
            ? (
                    <Link className={cn("text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline", ROW_ACTION_REVEAL_CLASS)} search={{ metric: row.original.metric_id, tab: "mapping-rules" }} to="/catalog">
                        Mapping rules
                    </Link>
                )
            : null),
        header: "",
        id: "rules",
    },
];

const SECTION_COLUMNS: Array<ColumnDef<V2SectionCatalogEntry>> = [
    { cell: ({ row }) => <Badge variant="outline">{row.original.form}</Badge>, header: "Form", id: "form" },
    { cell: ({ row }) => named(row.original.title, row.original.section_id), header: "Section", id: "title" },
];

const FORM_COLUMNS: Array<ColumnDef<V2FormCatalogEntry>> = [
    { cell: ({ row }) => <span className="font-medium">{row.original.form}</span>, header: "Form", id: "form" },
    { cell: ({ row }) => row.original.description, header: "Description", id: "description" },
    { cell: ({ row }) => <Badge variant="secondary">{row.original.family}</Badge>, header: "Family", id: "family" },
    {
        cell: ({ row }) => (
            <Link className="text-primary text-xs underline-offset-4 hover:underline" search={{ form: row.original.form, tab: "sections" }} to="/catalog">
                Sections
            </Link>
        ),
        header: "",
        id: "sections",
    },
];

const EVENT_TYPE_COLUMNS: Array<ColumnDef<V2EventTypeCatalogEntry>> = [
    { cell: ({ row }) => named(row.original.label, row.original.event_type), header: "Event type", id: "label" },
    { cell: ({ row }) => row.original.description, header: "Description", id: "description" },
];

const DOCUMENT_KIND_COLUMNS: Array<ColumnDef<V2DocumentKindCatalogEntry>> = [
    { cell: ({ row }) => named(row.original.label, row.original.kind), header: "Document kind", id: "label" },
    { cell: ({ row }) => <Badge variant="secondary">{row.original.category}</Badge>, header: "Category", id: "category" },
];

const MAPPING_RULE_COLUMNS: Array<ColumnDef<V2MappingRule>> = [
    {
        cell: ({ row }) => named(row.original.label, row.original.metric_id),
        header: "Metric",
        id: "metric_id",
    },
    { cell: ({ row }) => statementLabel(row.original.statement), header: "Statement", id: "statement" },
    { cell: ({ row }) => mappingRuleView(row.original.rule).kind, header: "Rule", id: "kind" },
    {
        cell: ({ row }) => <div className="max-w-[420px] whitespace-normal break-all font-mono text-xs">{mappingRuleView(row.original.rule).source ?? "—"}</div>,
        header: "Concept or formula",
        id: "source",
    },
    { cell: ({ row }) => mappingRuleView(row.original.rule).sign ?? "—", header: "Sign", id: "sign" },
    {
        cell: ({ row }) => {
            const parent = mappingRuleView(row.original.rule).parent;

            return parent ? mono(parent) : "—";
        },
        header: "Rolls up into",
        id: "parent",
    },
];

/** The state of one tab's list, as every catalog hook answers it. */
export type CatalogList<TRow> = {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    rows: ReadonlyArray<TRow>;
};

type TableSpec<TRow> = {
    columns: Array<ColumnDef<TRow>>;
    idOf: (row: TRow) => string;
    noun: string;
    operationId: OperationId;
    textsOf: (row: TRow) => ReadonlyArray<null | string | undefined>;
};

/** The table of each tab: columns, the id a catalog link filters by, the texts the filter searches, the operation. */
export const CATALOG_SPECS = {
    "document-kinds": { columns: DOCUMENT_KIND_COLUMNS, idOf: row => row.kind, noun: "document kinds", operationId: "listDocumentKindCatalog", textsOf: row => [row.label, row.category] } satisfies TableSpec<V2DocumentKindCatalogEntry>,
    "event-types": { columns: EVENT_TYPE_COLUMNS, idOf: row => row.event_type, noun: "event types", operationId: "listEventTypeCatalog", textsOf: row => [row.label, row.description] } satisfies TableSpec<V2EventTypeCatalogEntry>,
    "forms": { columns: FORM_COLUMNS, idOf: row => row.form, noun: "forms", operationId: "listFormCatalog", textsOf: row => [row.description, row.family] } satisfies TableSpec<V2FormCatalogEntry>,
    "mapping-rules": {
        columns: MAPPING_RULE_COLUMNS,
        idOf: row => row.metric_id,
        noun: "mapping rules",
        operationId: "listMappingRules",
        textsOf: (row) => {
            const view = mappingRuleView(row.rule);

            return [row.label, view.kind, view.source, view.parent];
        },
    } satisfies TableSpec<V2MappingRule>,
    "metrics": { columns: METRIC_COLUMNS, idOf: row => row.metric_id, noun: "metrics", operationId: "listMetricCatalog", textsOf: row => [row.name, row.description, row.unit] } satisfies TableSpec<V2MetricCatalogEntry>,
    "sections": { columns: SECTION_COLUMNS, idOf: row => row.section_id, noun: "sections", operationId: "listSectionCatalog", textsOf: row => [row.form, row.title] } satisfies TableSpec<V2SectionCatalogEntry>,
};

/** "342 metrics" / "12 of 342 metrics" / "+" while pages are still loading. */
export function catalogCountText(shown: number, loaded: number, noun: string, loading: boolean) {
    const total = `${formatNumber(loaded)}${loading ? "+" : ""}`;

    return shown === loaded && !loading ? `${total} ${noun}` : `${formatNumber(shown)} of ${total} ${noun}`;
}

/** One catalog tab's table (pure): every loaded row the filter keeps, the count, export of the shown rows. */
export function CatalogTable<TRow>({ list, query, scope, spec }: { list: CatalogList<TRow>; query: string | undefined; scope: string; spec: TableSpec<TRow> }) {
    const rows = React.useMemo(() => filterCatalogRows(list.rows, query, spec.idOf, spec.textsOf), [list.rows, query, spec]);

    if (list.error && list.rows.length === 0) return <SecReadinessNotice error={list.error} title={`Failed to load the ${spec.noun}`} />;

    const loading = list.isLoading || list.hasNextPage;

    return (
        <div className="flex flex-col gap-2">
            <DataTable
                columns={spec.columns}
                emptyText={query ? `No ${spec.noun} match "${query}".` : `No ${spec.noun}.`}
                exportConfig={{ dataset: `catalog-${spec.noun.replace(/\s+/g, "-")}`, scope }}
                hasNextPage={list.hasNextPage}
                isFetchingNextPage={list.isFetchingNextPage}
                isLoading={list.isLoading}
                onLoadMore={list.onLoadMore}
                operationId={spec.operationId}
                rows={rows}
                toolbarMeta={<span data-testid="catalog-count">{catalogCountText(rows.length, list.rows.length, spec.noun, loading)}</span>}
            />
            {list.error ? <SecReadinessNotice error={list.error} title={`Failed to load more ${spec.noun}`} /> : null}
        </div>
    );
}

/** An infinite catalog query as the table's list, every page loaded (the API has no text filter, so the page filters). */
function useCatalogList<TRow>(query: {
    data: null | { pages: ReadonlyArray<{ data: ReadonlyArray<TRow> }> };
    error: unknown;
    fetchNextPage: () => Promise<unknown>;
    hasNextPage: boolean;
    isFetching: boolean;
    isFetchingNextPage: boolean;
    isFetchNextPageError: boolean;
    isLoading: boolean;
}): CatalogList<TRow> {
    useAutoLoadPages(query);

    const rows = React.useMemo(() => query.data?.pages.flatMap(page => page.data) ?? [], [query.data]);

    return {
        error: query.error,
        hasNextPage: query.hasNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
        isLoading: query.isLoading,
        onLoadMore: () => void query.fetchNextPage(),
        rows,
    };
}

/** The open tab's table; only its own request runs (the other tabs' hooks are idle). */
function CatalogTabBody({ search }: { search: CatalogSearch }) {
    const tab: CatalogTab = search.tab ?? "metrics";

    const statement = search.statement ? [search.statement] : undefined;

    const metrics = useCatalogList(useMetricCatalogInfinite({ enabled: tab === "metrics", statement }));

    const sections = useCatalogList(useSectionCatalogInfinite({ enabled: tab === "sections", form: search.form ? [search.form.toUpperCase()] : undefined }));

    const forms = useCatalogList(useFormCatalogInfinite({ enabled: tab === "forms" }));

    const eventTypes = useCatalogList(useEventTypeCatalogInfinite({ enabled: tab === "event-types" }));

    const documentKinds = useCatalogList(useDocumentKindCatalogInfinite({ enabled: tab === "document-kinds" }));

    const rules = useCatalogList(useMappingRulesInfinite({ enabled: tab === "mapping-rules", metricId: search.metric ? [search.metric] : undefined, statement }));

    const scope = [search.statement, search.form, search.metric].filter(Boolean).join("-") || "all";

    switch (tab) {
        case "document-kinds": return <CatalogTable list={documentKinds} query={search.q} scope={scope} spec={CATALOG_SPECS["document-kinds"]} />;
        case "event-types": return <CatalogTable list={eventTypes} query={search.q} scope={scope} spec={CATALOG_SPECS["event-types"]} />;
        case "forms": return <CatalogTable list={forms} query={search.q} scope={scope} spec={CATALOG_SPECS.forms} />;
        case "macro": return <MacroCatalog filter={search.q} />;
        case "mapping-rules": return <CatalogTable list={rules} query={search.q} scope={scope} spec={CATALOG_SPECS["mapping-rules"]} />;
        case "metrics": return <CatalogTable list={metrics} query={search.q} scope={scope} spec={CATALOG_SPECS.metrics} />;
        case "sections": return <CatalogTable list={sections} query={search.q} scope={scope} spec={CATALOG_SPECS.sections} />;
    }
}

/** A removable filter chip ("Metric: is_total_revenue ×"). */
function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
    return (
        <Badge className="gap-1" variant="secondary">
            {label}
            <Button aria-label={`Clear ${label}`} className="size-4" onClick={onClear} size="icon" variant="ghost"><XIcon className="size-3" /></Button>
        </Badge>
    );
}

/**
 * The reference catalogs of the Data API (`/v1/catalog/*`, free, 1 credit a page): standardized metrics (the target of
 * every financial metric label's catalog link, `?q=<metric_id>`), filing sections per form, forms, event types,
 * investor-document kinds and the metrics' mapping rules. The open tab loads all its pages (≤ 5) and the text filter
 * searches them; statement / form / metric are sent to the API.
 */
function CatalogPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<CatalogSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const tab: CatalogTab = search.tab ?? "metrics";

    return (
        <PageContainer>
            <PageHeader
                description="The reference lists behind the Data API: what each standardized metric means and how it is mapped from filed concepts, the sections of each SEC form, the forms, event types and investor-document kinds."
                title="Catalog"
            />
            <Tabs
                // A tab change keeps the text filter but drops the other tab's API filters.
                onValueChange={value => onChange({ form: undefined, metric: undefined, statement: undefined, tab: value === "metrics" ? undefined : value as CatalogTab })}
                value={tab}
            >
                <TabsList aria-label="Catalog" className={WRAPPING_TABS_LIST_CLASS} variant="line">
                    {TAB_OPTIONS.map(option => <TabsTrigger key={option.value} value={option.value}>{option.label}</TabsTrigger>)}
                </TabsList>
            </Tabs>
            <FilterBar
                activeCount={[search.q, search.statement, search.form, search.metric].filter(value => value !== undefined).length}
                onReset={() => onChange({ form: undefined, metric: undefined, q: undefined, statement: undefined })}
            >
                <FilterField label="Filter" span={2}>
                    {id => <DebouncedInput aria-label="Filter the catalog" className="w-full" id={id} onCommit={q => onChange({ q: q || undefined })} placeholder="Filter by name, id or text" value={search.q ?? ""} />}
                </FilterField>
                {(tab === "metrics" || tab === "mapping-rules") && (
                    <FilterField label="Statement">
                        {id => <FilterSelect aria-label="Statement" className="w-full" id={id} onValueChange={value => onChange({ statement: value === ALL ? undefined : value })} options={STATEMENT_OPTIONS} value={search.statement ?? ALL} />}
                    </FilterField>
                )}
                {tab === "sections" && (
                    <FilterField label="Form">
                        {id => <DebouncedInput aria-label="Form" className="w-full" id={id} onCommit={form => onChange({ form: form.trim() || undefined })} placeholder="e.g. 10-K" value={search.form ?? ""} />}
                    </FilterField>
                )}
                {tab === "mapping-rules" && search.metric && (
                    <FilterBar.Trailing>
                        <FilterChip label={`Metric: ${search.metric}`} onClear={() => onChange({ metric: undefined })} />
                    </FilterBar.Trailing>
                )}
            </FilterBar>
            <CatalogTabBody search={search} />
        </PageContainer>
    );
}
