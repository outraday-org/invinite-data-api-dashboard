import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import type {
    MacroCurve,
    MacroFamily,
    MacroReading,
    MacroSearch,
    MacroSeries,
    ScalarFamily,
    Tenor,
} from "@/lib/api/macro";

import { usePlanAllows } from "@/components/ui/credit-hint";
import { DataTable } from "@/components/ui/data-table";
import { DayRange } from "@/components/ui/day-range";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ErrorState } from "@/components/ui/error-state";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Stat, StatGrid } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { familyId, MACRO_PAGES, macroView, tenorLabel, TENORS } from "@/lib/api/macro";
import {
    useMacroCatalog,
    useMacroCurves,
    useMacroCurveSnapshot,
    useMacroHistory,
    useMacroSnapshot,
} from "@/lib/api/macro-queries";
import { OPERATIONS } from "@/lib/api/operations.gen";
import { useAutoLoadPages } from "@/lib/api/use-auto-load-pages";

import { MacroAvailabilityNotice, useMacroAccess } from "./macro-availability";
import { historyPoints, MacroChart } from "./macro-chart";
import { MacroPageActions } from "./macro-page-actions";

type Props = { family: MacroFamily; search: MacroSearch; onChange: (patch: Partial<MacroSearch>) => void };

/** The plan gate of the history and snapshot reads (the Free catalog stays open). */
const gate = (allowed: boolean | null) =>
    allowed === false
        ? (
                <Notice title="History and snapshots require Lite.">
                    <Link className="underline" search={{ tab: "macro" }} to="/catalog">
                        Browse the Free macro catalog
                    </Link>
                    .
                </Notice>
            )
        : null;

const num = (value: null | number | undefined) =>
    value == null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 10 });

const periodText = { D: "Daily", M: "Monthly", Q: "Quarterly", W: "Weekly · Saturday end" } as const;

const changeUnit = (s: MacroReading) =>
    s.family === "inflation" ? "%" : s.unit === "percent" ? "percentage points" : s.unit;

export const scalarColumns = (
    family: ScalarFamily,
    meta: Array<MacroSeries>,
    search: MacroSearch,
): Array<ColumnDef<MacroReading>> => [
    {
        cell: ({ row: { original: r } }) => {
            const label = meta.find(s => s.series_id === r.series_id)?.label ?? r.series_id;

            return macroView(search) === "history" ? label : <Link className="font-medium underline" search={{ ...search, series: r.series_id, view: "history" }} to={MACRO_PAGES[family].path}>{label}</Link>;
        },
        header: "Series",
        id: "series_id",
    },
    { accessorKey: "reference_date", header: "Reference period" },
    {
        cell: ({ row: { original: r } }) => (
            <span>
                {num(r.value)}
                {" "}
                <span className="text-muted-foreground">
                    {r.unit}
                    {r.base_period ? ` · ${r.base_period}` : ""}
                    {meta.find(item => item.series_id === r.series_id)?.annual_rate ? " · annual rate" : ""}
                </span>
            </span>
        ),
        header: "Level / rate",
        id: "value",
    },
    {
        cell: ({ row: { original: r } }) =>
            `${num("change_1m_pct" in r ? r.change_1m_pct : r.change_prior)} ${changeUnit(r)}`,
        header: family === "inflation" ? "1-month change" : "Change since prior period",
        id: "prior",
    },
    {
        cell: ({ row: { original: r } }) =>
            `${num("change_12m_pct" in r ? r.change_12m_pct : r.change_year)} ${changeUnit(r)}`,
        header: "Year change",
        id: "annual",
    },
    ...(family === "inflation"
        ? []
        : [
                {
                    accessorFn: (r: MacroReading) => num("change_year_pct" in r ? r.change_year_pct : null),
                    header: "Year change (%)",
                    id: "change_year_pct",
                },
            ]),
    { accessorFn: r => periodText[r.frequency], header: "Frequency" },
    { accessorKey: "seasonal_adjustment", header: "Adjustment" },
    {
        cell: ({ row: { original: r } }) => (
            <a className="underline" href={r.source_url} rel="noreferrer" target="_blank">
                {r.agency}
            </a>
        ),
        header: "Agency",
        id: "agency",
    },
    { accessorFn: r => r.published_at ?? "Unknown", header: "Official publication" },
    { accessorKey: "observed_at", header: "Observed (UTC)" },
    { accessorKey: "status", header: "Status" },
];

/** The headline series of the snapshot view (the first eight the snapshot answers), from the rows already loaded. */
const SNAPSHOT_STATS = 8;

/**
 * Snapshot view only: the latest value, its change and reference period per headline series — built from the snapshot
 * rows the table shows (no request of its own; the history view has no snapshot rows, so no grid).
 */
function ScalarSnapshotStats({ meta, rows }: { meta: Array<MacroSeries>; rows: Array<MacroReading> }) {
    if (rows.length === 0) return null;

    return (
        <StatGrid>
            {rows.slice(0, SNAPSHOT_STATS).map((r) => {
                const change = "change_12m_pct" in r ? r.change_12m_pct : r.change_prior;

                return (
                    <Stat
                        key={r.series_id}
                        label={meta.find(item => item.series_id === r.series_id)?.label ?? r.series_id}
                        sub={`${"change_12m_pct" in r ? "12 months" : "vs prior"} ${num(change)} ${changeUnit(r)} · ${r.reference_date}`}
                        value={`${num(r.value)} ${r.unit}`}
                    />
                );
            })}
        </StatGrid>
    );
}

/** The maturities of the snapshot grid (short, 2-year, 10-year, 30-year). */
const CURVE_STATS: ReadonlyArray<Tenor> = ["m3", "y2", "y10", "y30"];

function CurveSnapshotStats({ curve }: { curve: MacroCurve }) {
    return (
        <StatGrid>
            {CURVE_STATS.map(t => <Stat key={t} label={tenorLabel(t)} sub={curve.date} value={curve[t] == null ? "—" : `${num(curve[t])} %`} />)}
        </StatGrid>
    );
}

/** The page frame while macro access is not confirmed: the title and the availability notice (no request, no socket). */
function MacroFrame({ children, family }: { children: ReactNode; family: MacroFamily }) {
    const access = useMacroAccess();

    if (access === "available") return children;

    // A refused key: the onboarding card is its own page frame.
    if (access === "invalid") return <MacroAvailabilityNotice access={access} />;

    const page = MACRO_PAGES[family];

    return (
        <PageContainer width="wide">
            <PageHeader description={page.description} title={page.title} />
            <MacroAvailabilityNotice access={access} />
        </PageContainer>
    );
}

function Panel({ children, family, onChange, search, seriesId }: Props & { seriesId: string; children: ReactNode }) {
    const mode = macroView(search),
        page = MACRO_PAGES[family],
        operation = page[family === "yield_curve" && mode === "snapshot" && search.date ? "history" : mode];

    return (
        <PageContainer width="wide">
            <PageHeader
                actions={<MacroPageActions family={family} selectedDate={search.date} seriesId={seriesId} />}
                description={page.description}
                title={page.title}
            />
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <Tabs onValueChange={v => onChange({ view: v === "history" ? "history" : "snapshot" })} value={mode}>
                    <TabsList aria-label="Macro view" variant="line">
                        <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="flex gap-3 pb-2 text-xs">
                    <Link className="text-muted-foreground hover:text-foreground underline underline-offset-4" search={{ tab: "macro" }} to="/catalog">
                        Series catalog
                    </Link>
                    <a className="text-muted-foreground hover:text-foreground underline underline-offset-4" href={OPERATIONS[operation].docsUrl}>
                        API reference
                    </a>
                </div>
            </div>
            {children}
        </PageContainer>
    );
}

export function ScalarMacroPage(props: Props & { family: ScalarFamily }) {
    return <MacroFrame family={props.family}><ScalarMacroContent {...props} /></MacroFrame>;
}

function ScalarMacroContent({ family, onChange, search }: Props & { family: ScalarFamily }) {
    const metadata = useMacroCatalog(family);

    useAutoLoadPages(metadata);

    const series = familyId(search.series, family) ? search.series : MACRO_PAGES[family].defaultSeries;

    const history = macroView(search) === "history";

    const op = MACRO_PAGES[family][history ? "history" : "snapshot"];

    const allowed = usePlanAllows(op);

    const snapshots = useMacroSnapshot(family, allowed === true && !history);

    useAutoLoadPages(snapshots, { enabled: !history && allowed === true });

    const past = useMacroHistory(family, series, search.from, search.to, allowed === true && history);

    const data = history ? past : snapshots;

    const meta = metadata.data?.pages.flatMap(p => p.data) ?? [];

    const info = meta.find(r => r.series_id === series);

    const rows: Array<MacroReading> = data.data?.pages.flatMap<MacroReading>(page => page.data) ?? [];

    const select = (id: string) => onChange({ series: id, view: "history" });

    const infoText = info
        ? [
                info.unit + (info.base_period ? ` (${info.base_period})` : ""),
                `source scale ×${info.scale}`,
                periodText[info.frequency],
                info.seasonal_adjustment,
                `${info.first_date ?? "No coverage"} to ${info.last_date ?? "—"}`,
            ].join(" · ")
        : null;

    return (
        <Panel {...{ family, onChange, search }} seriesId={series}>
            {metadata.error && <ErrorState error={metadata.error} title="Could not load the series catalog" />}
            {gate(allowed)}
            {allowed === true && (
                <>
                    {!history && <ScalarSnapshotStats meta={meta} rows={rows} />}
                    {history && (
                        <>
                            <FilterBar activeCount={search.from ?? search.to ? 1 : 0} onReset={() => onChange({ from: undefined, to: undefined })}>
                                <FilterField label="Series" span={2}>
                                    {id => (
                                        <DropdownSelect
                                            aria-label="Series"
                                            className="w-full"
                                            id={id}
                                            onValueChange={select}
                                            options={meta.map(r => ({ label: r.label, value: r.series_id }))}
                                            placeholder={series}
                                            value={series}
                                        />
                                    )}
                                </FilterField>
                                <FilterField label="Reference period" span={2}>
                                    <DayRange
                                        from={search.from}
                                        labels={{ from: "From reference date", to: "Through reference date" }}
                                        onChange={onChange}
                                        to={search.to}
                                    />
                                </FilterField>
                            </FilterBar>
                            {rows.length > 0 && (
                                <Section description={infoText} title="Chart">
                                    <MacroChart
                                        points={historyPoints(
                                            rows.map(r => ({ label: r.reference_date, value: r.value })),
                                            info?.frequency ?? rows[0].frequency,
                                        )}
                                        title={info?.label ?? series}
                                        unit={info?.unit ?? rows[0].unit}
                                    />
                                </Section>
                            )}
                        </>
                    )}
                    <DataTable
                        columns={scalarColumns(family, meta, search)}
                        emptyText="No readings for this selection."
                        errorState={
                            data.error ? <ErrorState error={data.error} title="Could not load macro readings" /> : null
                        }
                        exportConfig={{
                            dataset: family,
                            scope: history ? [series, search.from, search.to].filter(Boolean).join("-") : "snapshot",
                        }}
                        hasNextPage={data.hasNextPage}
                        isFetchingNextPage={data.isFetchingNextPage}
                        isLoading={data.isLoading}
                        onLoadMore={() => void data.fetchNextPage()}
                        operationId={op}
                        rows={rows}
                        toolbarMeta={history && rows.length > 0
                            ? `Loaded range ${rows.at(-1)!.reference_date} – ${rows[0].reference_date}; exports include these ${rows.length} readings.`
                            : null}
                    />
                </>
            )}
        </Panel>
    );
}

/**
 * The curve table's columns. History: one row per quotation date with every maturity. Snapshot: the maturities are
 * already the table beside the chart, so the row keeps the date and its source only (the export still has them all).
 */
const curveColumns = (search: MacroSearch): Array<ColumnDef<MacroCurve>> => [
    {
        cell: ({ row: { original: r } }) => macroView(search) === "history" ? <Link className="font-medium underline" search={{ ...search, date: r.date, view: "snapshot" }} to="/us-macro/yield-curve">{r.date}</Link> : r.date,
        header: "Quotation date",
        id: "date",
    },
    ...(macroView(search) === "history" ? TENORS.map(t => ({ accessorFn: (r: MacroCurve) => num(r[t]), header: tenorLabel(t), id: t })) : []),
    {
        cell: ({ row: { original: r } }) => (
            <a className="underline" href={r.source_url} rel="noreferrer" target="_blank">
                {r.agency}
            </a>
        ),
        header: "Agency",
        id: "agency",
    },
    { accessorKey: "observed_at", header: "Observed (UTC)" },
];

type MaturityRow = { tenor: Tenor; value: null | number | undefined };

/** The curve's maturities as rows: the labelled table beside the curve chart. */
const MATURITY_COLUMNS: Array<ColumnDef<MaturityRow>> = [
    { cell: ({ row }) => tenorLabel(row.original.tenor), header: "Maturity", id: "tenor" },
    { cell: ({ row }) => <div className="text-right tabular-nums">{num(row.original.value)}</div>, header: () => <div className="text-right">Yield (%)</div>, id: "value" },
];

export function TreasuryMacroPage(props: Omit<Props, "family">) {
    return <MacroFrame family="yield_curve"><TreasuryMacroContent {...props} /></MacroFrame>;
}

function TreasuryMacroContent({ onChange, search }: Omit<Props, "family">) {
    const family = "yield_curve" as const,
        history = macroView(search) === "history",
        tenor: Tenor = search.tenor ?? "y10";

    const dated = !history && !!search.date;

    const op = MACRO_PAGES[family][history || dated ? "history" : "snapshot"];

    const allowed = usePlanAllows(op);

    const metadata = useMacroCatalog(family);

    useAutoLoadPages(metadata);

    const catalog = metadata.data?.pages.flatMap(page => page.data) ?? [];

    const choices = catalog.flatMap((series) => {
        const key = TENORS.find(t => t === series.tenor);

        return key ? [{ key, series }] : [];
    }).sort((a, b) => (a.series.maturity_months ?? 0) - (b.series.maturity_months ?? 0));

    const selected = choices.find(c => c.key === tenor)?.series;

    const latest = useMacroCurveSnapshot(allowed === true && !history && !dated);

    const past = useMacroCurves(
        dated ? search.date : search.from,
        dated ? search.date : search.to,
        allowed === true && (history || dated),
    );

    const rows: Array<MacroCurve>
        = history || dated ? (past.data?.pages.flatMap(p => p.data) ?? []) : latest.data ? [latest.data] : [];

    const curve = rows.at(0),
        error = history || dated ? past.error : latest.error;

    const chart = curve && (
        <MacroChart
            maturity={!history}
            points={
                history
                    ? historyPoints(
                            rows.map(r => ({ label: r.date, value: r[tenor] })),
                            "D",
                        )
                    : TENORS.map(t => ({
                            label: tenorLabel(t),
                            value: curve[t],
                            x: t.startsWith("y")
                                ? Number(t.slice(1)) * 12
                                : Number(t.slice(1).replace("_", ".")),
                        }))
            }
            title={history ? `${tenorLabel(tenor)} Treasury history` : `Treasury curve · ${curve.date}`}
            unit="Yield (%)"
        />
    );

    return (
        <Panel {...{ family, onChange, search }} seriesId={`treasury_par_${tenor}`}>
            {metadata.error && <ErrorState error={metadata.error} title="Could not load Treasury maturity coverage" />}
            {gate(allowed)}
            {allowed === true && (
                <>
                    {history
                        ? (
                                <FilterBar activeCount={search.from ?? search.to ? 1 : 0} onReset={() => onChange({ from: undefined, to: undefined })}>
                                    <FilterField label="Maturity">
                                        {id => (
                                            <DropdownSelect
                                                aria-label="Maturity"
                                                className="w-full"
                                                id={id}
                                                onValueChange={value => onChange({ tenor: TENORS.find(t => t === value) })}
                                                options={choices.map(({ key, series }) => ({ label: `${tenorLabel(key)}${series.first_date ? "" : " · no coverage"}`, value: key }))}
                                                placeholder={tenorLabel(tenor)}
                                                value={tenor}
                                            />
                                        )}
                                    </FilterField>
                                    <FilterField label="Quotation dates" span={2}>
                                        <DayRange
                                            from={search.from}
                                            labels={{ from: "From quotation date", to: "Through quotation date" }}
                                            onChange={onChange}
                                            to={search.to}
                                        />
                                    </FilterField>
                                </FilterBar>
                            )
                        : (
                                <FilterBar activeCount={search.date ? 1 : 0} onReset={() => onChange({ date: undefined })}>
                                    <FilterField label="Quotation date">
                                        {id => (
                                            <Input
                                                aria-label="Quotation date"
                                                className="w-full"
                                                id={id}
                                                onChange={e => onChange({ date: e.target.value || undefined })}
                                                type="date"
                                                value={search.date ?? ""}
                                            />
                                        )}
                                    </FilterField>
                                </FilterBar>
                            )}
                    {!history && curve && <CurveSnapshotStats curve={curve} />}
                    {chart && (history
                        ? (
                                <Section
                                    description={selected ? `${selected.label} · ${selected.unit} · ${selected.first_date ?? "No coverage"} to ${selected.last_date ?? "—"}` : undefined}
                                    title="Chart"
                                >
                                    {chart}
                                </Section>
                            )
                        : (
                                // The curve and its maturities as a labelled table: side by side from 1280 px, stacked below.
                                <Section title="Curve">
                                    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                                        <div className="min-w-0">{chart}</div>
                                        <DataTable
                                            columns={MATURITY_COLUMNS}
                                            emptyText="No maturities."
                                            isLoading={false}
                                            rows={TENORS.map(t => ({ tenor: t, value: curve[t] }))}
                                        />
                                    </div>
                                </Section>
                            ))}
                    <DataTable
                        columns={curveColumns(search)}
                        emptyText="No published curve for this date or range."
                        errorState={error ? <ErrorState error={error} title="Could not load Treasury curves" /> : null}
                        exportConfig={{
                            dataset: "treasury-par-yields",
                            scope: history
                                ? [search.from, search.to].filter(Boolean).join("-") || "history"
                                : (curve?.date ?? "snapshot"),
                        }}
                        hasNextPage={history && past.hasNextPage}
                        isFetchingNextPage={past.isFetchingNextPage}
                        isLoading={history || dated ? past.isLoading : latest.isLoading}
                        onLoadMore={() => void past.fetchNextPage()}
                        operationId={op}
                        rows={rows}
                        toolbarMeta={rows.length > 0
                            ? `Quotation dates ${rows.at(-1)!.date} – ${rows[0].date}; CSV and JSON include all fourteen maturities.`
                            : null}
                    />
                </>
            )}
        </Panel>
    );
}
