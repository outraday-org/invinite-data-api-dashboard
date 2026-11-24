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

import { TabStrip } from "@/components/navigation/tab-strip";
import { usePlanAllows } from "@/components/ui/credit-hint";
import { DataTable } from "@/components/ui/data-table";
import { DayRange } from "@/components/ui/day-range";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
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

import { MacroAvailability } from "./macro-availability";
import { historyPoints, MacroChart } from "./macro-chart";
import { MacroPageActions } from "./macro-page-actions";

type Props = { family: MacroFamily; search: MacroSearch; onChange: (patch: Partial<MacroSearch>) => void };

const gate = (allowed: boolean | null) =>
    allowed === false
        ? (
                <p>
                    History and snapshots require Lite.
                    <Link className="underline" search={{ tab: "macro" }} to="/catalog">
                        Browse the Free macro catalog
                    </Link>
                    .
                </p>
            )
        : null;

const tabs = [
    { label: "Snapshot", value: "snapshot" },
    { label: "History", value: "history" },
] as const;

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

function Panel({ children, family, onChange, search, seriesId }: Props & { seriesId: string; children: ReactNode }) {
    const mode = macroView(search),
        page = MACRO_PAGES[family],
        operation = page[family === "yield_curve" && mode === "snapshot" && search.date ? "history" : mode];

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 lg:px-8">
            <PageHeader
                actions={<MacroPageActions family={family} selectedDate={search.date} seriesId={seriesId} />}
                description={page.description}
                title={page.title}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <TabStrip
                    aria-label="Macro view"
                    onSelect={v => onChange({ view: v })}
                    options={[...tabs]}
                    value={mode}
                />
                <div className="flex gap-3">
                    <Link className="underline" search={{ tab: "macro" }} to="/catalog">
                        Series catalog
                    </Link>
                    <a className="underline" href={OPERATIONS[operation].docsUrl}>
                        API reference
                    </a>
                </div>
            </div>
            {children}
        </div>
    );
}

export function ScalarMacroPage(props: Props & { family: ScalarFamily }) {
    return <MacroAvailability><ScalarMacroContent {...props} /></MacroAvailability>;
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

    return (
        <Panel {...{ family, onChange, search }} seriesId={series}>
            {metadata.error && <ErrorState error={metadata.error} title="Could not load the series catalog" />}
            {gate(allowed)}
            {allowed === true && (
                <>
                    {history && (
                        <>
                            <div className="flex flex-wrap items-center gap-3">
                                <label>
                                    Series
                                    <select
                                        aria-label="Series"
                                        className="rounded border bg-background p-1.5"
                                        onChange={e => select(e.target.value)}
                                        value={series}
                                    >
                                        {meta.map(r => (
                                            <option key={r.series_id} value={r.series_id}>
                                                {r.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <DayRange
                                    from={search.from}
                                    labels={{ from: "From reference date", to: "Through reference date" }}
                                    onChange={onChange}
                                    to={search.to}
                                />
                            </div>
                            {info && (
                                <p className="text-muted-foreground">
                                    {info.label}
                                    {" "}
                                    ·
                                    {info.unit}
                                    {info.base_period ? ` · ${info.base_period}` : ""}
                                    {" "}
                                    · source scale ×
                                    {info.scale}
                                    {" "}
                                    ·
                                    {periodText[info.frequency]}
                                    {" "}
                                    ·
                                    {info.seasonal_adjustment}
                                    {" "}
                                    ·
                                    {info.first_date ?? "No coverage"}
                                    {" "}
                                    to
                                    {info.last_date ?? "—"}
                                </p>
                            )}
                            {rows.length > 0 && (
                                <MacroChart
                                    points={historyPoints(
                                        rows.map(r => ({ label: r.reference_date, value: r.value })),
                                        info?.frequency ?? rows[0].frequency,
                                    )}
                                    title={info?.label ?? series}
                                    unit={info?.unit ?? rows[0].unit}
                                />
                            )}
                        </>
                    )}
                    {history && rows.length > 0 && (
                        <p className="text-muted-foreground">
                            Loaded range:
                            {rows.at(-1)!.reference_date}
                            {" "}
                            –
                            {rows[0].reference_date}
                            . Exports include these
                            {rows.length}
                            {" "}
                            readings.
                        </p>
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
                    />
                </>
            )}
        </Panel>
    );
}

const curveColumns = (search: MacroSearch): Array<ColumnDef<MacroCurve>> => [
    {
        cell: ({ row: { original: r } }) => macroView(search) === "history" ? <Link className="font-medium underline" search={{ ...search, date: r.date, view: "snapshot" }} to="/us-macro/yield-curve">{r.date}</Link> : r.date,
        header: "Quotation date",
        id: "date",
    },
    ...TENORS.map(t => ({ accessorFn: (r: MacroCurve) => num(r[t]), header: tenorLabel(t), id: t })),
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

export function TreasuryMacroPage(props: Omit<Props, "family">) {
    return <MacroAvailability><TreasuryMacroContent {...props} /></MacroAvailability>;
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

    return (
        <Panel {...{ family, onChange, search }} seriesId={`treasury_par_${tenor}`}>
            {metadata.error && <ErrorState error={metadata.error} title="Could not load Treasury maturity coverage" />}
            {gate(allowed)}
            {allowed === true && (
                <>
                    <div className="flex flex-wrap items-center gap-3">
                        {history
                            ? (
                                    <>
                                        <label>
                                            Maturity
                                            <select
                                                aria-label="Maturity"
                                                className="rounded border bg-background p-1.5"
                                                onChange={e => onChange({ tenor: TENORS.find(t => t === e.target.value) })}
                                                value={tenor}
                                            >
                                                {choices.map(({ key, series }) => (
                                                    <option key={key} value={key}>
                                                        {tenorLabel(key)}
                                                        {series.first_date ? "" : " · no coverage"}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <DayRange
                                            from={search.from}
                                            labels={{ from: "From quotation date", to: "Through quotation date" }}
                                            onChange={onChange}
                                            to={search.to}
                                        />
                                    </>
                                )
                            : (
                                    <label>
                                        Quotation date
                                        <input
                                            aria-label="Quotation date"
                                            className="rounded border bg-background p-1.5"
                                            onChange={e => onChange({ date: e.target.value || undefined })}
                                            type="date"
                                            value={search.date ?? ""}
                                        />
                                    </label>
                                )}
                    </div>
                    {history && selected && (
                        <p className="text-muted-foreground">
                            {selected.label}
                            {" "}
                            ·
                            {" "}
                            {selected.unit}
                            {" "}
                            ·
                            {" "}
                            {selected.first_date ?? "No coverage"}
                            {" "}
                            to
                            {" "}
                            {selected.last_date ?? "—"}
                        </p>
                    )}
                    {curve && (
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
                    )}
                    {rows.length > 0 && (
                        <p className="text-muted-foreground">
                            Loaded quotation dates:
                            {rows.at(-1)!.date}
                            {" "}
                            –
                            {rows[0].date}
                            . CSV and JSON include all fourteen maturities.
                        </p>
                    )}
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
                    />
                </>
            )}
        </Panel>
    );
}
