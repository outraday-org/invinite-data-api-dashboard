import type { ColumnDef, ColumnDefTemplate, Row } from "@tanstack/react-table";

import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import * as React from "react";

import type { ExportConfig } from "@/components/api/export-menu";
import type { OperationId } from "@/lib/api/operations.gen";

import { ExportMenu } from "@/components/api/export-menu";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { ScrollEdgeFades } from "@/components/ui/scroll-row";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { LG_STICKY_TOP_CLASS } from "@/lib/layout";
import { cn } from "@/lib/utils";

/**
 * A column's header / cell, called inside this one stable component. `flexRender` mounts a function template as its own
 * component type, so a page that builds its columns again on a render (a URL change: `?filing=`, a sort) remounted every
 * cell — the focused button was replaced and focus fell to the page (F101). A template may still use hooks: they belong
 * to this component, and a column keeps its template's shape from render to render.
 */
function ColumnContent<TProps extends object>({ props, template }: { props: TProps; template: ColumnDefTemplate<TProps> | undefined }) {
    return <>{typeof template === "function" ? template(props) : template}</>;
}

/** Skeleton rows shown while the first page loads. */
const SKELETON_ROWS = 5;

/**
 * Whether the table fits its column (no horizontal scroller needed), and whether a scroller is scrolled to its right
 * end. A table wider than its column keeps the wrapper as its horizontal scroller, so the page never scrolls sideways;
 * only a table that fits lets its header stick to the window; a cut table fades its right edge until scrolled to the end.
 * Without `ResizeObserver` (tests, SSR) the table counts as fitting.
 */
function useTableFits(wrapper: React.RefObject<HTMLDivElement | null>) {
    const [fits, setFits] = React.useState(true);

    const [atEnd, setAtEnd] = React.useState(true);

    React.useEffect(() => {
        const element = wrapper.current;

        const table = element?.querySelector("table");

        const scroller = element?.querySelector<HTMLElement>("[data-slot=table-container]");

        if (!element || !table || typeof ResizeObserver === "undefined") return;

        // +1: sub-pixel rounding of a table exactly as wide as its column.
        const measure = () => {
            setFits(table.getBoundingClientRect().width <= element.clientWidth + 1);

            setAtEnd(!scroller || scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1);
        };

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(element);

        observer.observe(table);

        scroller?.addEventListener("scroll", measure, { passive: true });

        return () => {
            observer.disconnect();

            scroller?.removeEventListener("scroll", measure);
        };
    }, [wrapper]);

    return { atEnd, fits };
}

const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, label, summary, [role='button'], [role='menuitem'], [role='checkbox']";

/** A plain primary click on the row itself: not on a control inside it, not the end of a text selection. */
function isRowClick(event: React.MouseEvent<HTMLTableRowElement>) {
    if (event.defaultPrevented || event.button !== 0) return false;

    if (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR)) return false;

    return !window.getSelection()?.toString();
}

/** "40 loaded" while a next page exists (the API has no total), else "12 rows". */
export function loadedCountText(count: number, hasNextPage: boolean) {
    if (hasNextPage) return `${formatNumber(count)} loaded`;

    return `${formatNumber(count)} ${count === 1 ? "row" : "rows"}`;
}

/** A right-aligned, tabular-figure cell (numbers, amounts) of a `DataTable` column. */
export const right = (text: string) => <div className="text-right tabular-nums">{text}</div>;

/**
 * The one table of the dashboard's lists (grown from `V2ListTable`): the page scrolls, not the table.
 *
 * - Header: sticks below the pinned top bar + ticker header (`LG_STICKY_TOP_CLASS`) from `lg` up while the table fits
 *   its column (`useTableFits`). Below `lg`, and for a table wider than its column, the wrapper scrolls sideways and the
 *   header scrolls with the page (a sticky header inside a horizontal scroller binds to the scroller — CSS cannot do
 *   both); the page itself never scrolls sideways.
 * - `stickyFirstColumn` (wide tables: insider trades): the wrapper scrolls sideways at every width, the first column
 *   stays; the header is then never window-sticky (same CSS limit).
 * - Below 640 px a table of more than 4 columns keeps its first column (the wrapper scrolls sideways), and so does such
 *   a table at any width once it is wider than its column (a docked request panel); a cut table fades its right edge
 *   until scrolled to the end.
 * - Toolbar (ui-redesign task 6): left the count ("40 loaded" / "12 rows") and `toolbarMeta`, right the "Export" menu;
 *   while the first page loads it keeps its height (no jump), and it is left out when it has nothing to show.
 * - States: skeleton rows while the first page loads, `errorState` in a full-width row (first page or a failed next
 *   page), the empty row only for a genuine empty answer (`emptyIsGenuine`: a pending / partial coverage's notice
 *   stands above the table instead) — both in a 120 px block —, "Load more" centred under the table by `next_cursor`.
 * - Rows: hover fill, first column `font-medium`; a `Copyable` id shows its copy button on row hover / focus.
 * - O6: `operationId` (the list's operation) puts its cost on "Load more"; `exportConfig` adds the "Export" menu
 *   (CSV / JSON of the loaded rows, "load all" after a confirm naming the per-page cost).
 */
export function DataTable<TRow>({
    columnClassName,
    columns,
    emptyIsGenuine = true,
    emptyText,
    errorState,
    exportConfig,
    getRowId,
    groupHeading,
    groupOf,
    hasNextPage = false,
    isFetchingNextPage = false,
    isLoading,
    onLoadMore,
    onRowClick,
    operationId,
    rowClassName,
    rows,
    stickyFirstColumn = false,
    toolbarMeta,
}: {
    /** Extra classes per column id (widths, alignment). */
    columnClassName?: (columnId: string) => string | undefined;
    columns: Array<ColumnDef<TRow>>;
    emptyIsGenuine?: boolean;
    emptyText: React.ReactNode;
    /** A rendered error (`ErrorState`, `SecReadinessNotice`) for a failed request; null / undefined = none. */
    errorState?: React.ReactNode;
    /** The "Export" menu above the table (rows as given; columns default to every field, flattened). */
    exportConfig?: ExportConfig<TRow>;
    /**
     * A row's stable id (the React key of its row): a row added on top then never re-keys the rows below (their
     * animation / state stays). Default: the row's index.
     */
    getRowId?: (row: TRow) => string;
    /** The heading row of a group (its key and its rows); rendered with `groupOf`. */
    groupHeading?: (group: string, rows: ReadonlyArray<TRow>) => React.ReactNode;
    /**
     * Groups consecutive rows (the rows come sorted by group, e.g. the calendar's New York day): a full-width heading row
     * before each group that sticks below the pinned header from `lg` up (the column header then scrolls with the page).
     */
    groupOf?: (row: TRow) => string;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    isLoading: boolean;
    onLoadMore?: () => void;
    /**
     * Makes the whole row a click target (a pointer cursor): a click that lands on a link, button or input of the row,
     * or that ends a text selection, is left to it. The row keeps a real link in a cell for the keyboard.
     */
    onRowClick?: (row: TRow, event: React.MouseEvent<HTMLTableRowElement>) => void;
    /** The list's operation: its cost on "Load more" and in the export's "load all". */
    operationId?: OperationId;
    rowClassName?: (row: TRow) => string | undefined;
    rows: Array<TRow>;
    stickyFirstColumn?: boolean;
    /** A meta / coverage line in the toolbar, after the count. */
    toolbarMeta?: React.ReactNode;
}) {
    const table = useReactTable({ columns, data: rows, getCoreRowModel: getCoreRowModel(), getRowId: getRowId ? row => getRowId(row) : undefined });

    const columnCount = Math.max(1, columns.length);

    const wrapper = React.useRef<HTMLDivElement>(null);

    const { atEnd, fits } = useTableFits(wrapper);

    const stickyHeader = !stickyFirstColumn && fits && !groupOf;

    const groupRows = React.useMemo(() => {
        const groups = new Map<string, Array<TRow>>();

        if (!groupOf) return groups;

        for (const row of rows) groups.set(groupOf(row), [...(groups.get(groupOf(row)) ?? []), row]);

        return groups;
    }, [groupOf, rows]);

    // Below 640 px a wide table (more than 4 columns) keeps its first column too; at any width once it is cut (task 8).
    const phoneSticky = !stickyFirstColumn && columns.length > 4;

    const firstColumn = (index: number) => {
        if (index !== 0) return undefined;

        // Opaque (the scrolled cells pass under it), the row's 50 % hover fill mixed in.
        if (stickyFirstColumn || (phoneSticky && !fits)) return "sticky left-0 z-10 bg-background group-hover/row:bg-[color-mix(in_oklch,var(--muted)_50%,var(--background))]";

        return phoneSticky ? "max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:bg-background max-sm:group-hover/row:bg-[color-mix(in_oklch,var(--muted)_50%,var(--background))]" : undefined;
    };

    const showSkeleton = isLoading && rows.length === 0 && !errorState;

    const showEmpty = !isLoading && rows.length === 0 && emptyIsGenuine && !errorState;

    const count = rows.length > 0 ? loadedCountText(rows.length, hasNextPage) : null;

    const showToolbar = Boolean(exportConfig || toolbarMeta || count || showSkeleton);

    return (
        <div className="flex min-w-0 flex-col gap-2" data-slot="data-table" ref={wrapper}>
            {showToolbar && (
                <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-1" data-slot="data-table-toolbar">
                    <div className="text-muted-foreground flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {count && <span className="tabular-nums" data-testid="data-table-count">{count}</span>}
                        {toolbarMeta}
                    </div>
                    {exportConfig && (
                        <ExportMenu
                            config={exportConfig}
                            failed={!!errorState}
                            hasNextPage={hasNextPage}
                            isFetchingNextPage={isFetchingNextPage}
                            onLoadMore={onLoadMore}
                            operationId={operationId}
                            rows={rows}
                        />
                    )}
                </div>
            )}
            <div className="relative min-w-0">
                <Table containerClassName={stickyHeader || (groupOf && fits) ? "lg:overflow-x-visible" : undefined}>
                    <TableHeader className={cn(stickyHeader && cn("bg-background lg:sticky lg:z-20", LG_STICKY_TOP_CLASS))}>
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header, index) => (
                                    <TableHead className={cn(firstColumn(index), columnClassName?.(header.column.id))} key={header.id}>
                                        {header.isPlaceholder ? null : <ColumnContent props={header.getContext()} template={header.column.columnDef.header} />}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.map((row: Row<TRow>, rowIndex, all) => {
                            const group = groupOf?.(row.original);

                            const startsGroup = group !== undefined && (rowIndex === 0 || groupOf?.(all[rowIndex - 1].original) !== group);

                            return (
                                <React.Fragment key={row.id}>
                                    {startsGroup && (
                                        <TableRow className="hover:bg-transparent" data-testid="data-table-group">
                                            <TableCell
                                                className={cn("bg-muted/95 supports-backdrop-filter:backdrop-blur py-1.5 font-medium lg:sticky lg:z-10", fits && LG_STICKY_TOP_CLASS)}
                                                colSpan={columnCount}
                                            >
                                                {groupHeading ? groupHeading(group, groupRows.get(group) ?? []) : group}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    <TableRow
                                        className={cn(onRowClick && "cursor-pointer", rowClassName?.(row.original))}
                                        onClick={onRowClick
                                            ? (event) => {
                                                    if (isRowClick(event)) onRowClick(row.original, event);
                                                }
                                            : undefined}
                                    >
                                        {row.getVisibleCells().map((cell, index) => (
                                            <TableCell className={cn(index === 0 && "font-medium", firstColumn(index), columnClassName?.(cell.column.id))} key={cell.id}>
                                                <ColumnContent props={cell.getContext()} template={cell.column.columnDef.cell} />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </React.Fragment>
                            );
                        })}

                        {showSkeleton && Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
                            <TableRow data-testid="data-table-skeleton" key={`skeleton-${rowIndex}`}>
                                {Array.from({ length: columnCount }, (__, cellIndex) => (
                                    <TableCell key={cellIndex}><Skeleton className="h-4 w-full min-w-8" /></TableCell>
                                ))}
                            </TableRow>
                        ))}

                        {showEmpty && (
                            <TableRow className="hover:bg-transparent">
                                <TableCell className="text-muted-foreground h-30 text-center text-sm whitespace-normal" colSpan={columnCount}>{emptyText}</TableCell>
                            </TableRow>
                        )}

                        {errorState && (
                            <TableRow className="hover:bg-transparent">
                                <TableCell className="h-30 text-sm whitespace-normal" colSpan={columnCount}>{errorState}</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                {/* The cut edge of a table wider than its column, until scrolled to the end. */}
                <ScrollEdgeFades edges={{ end: !fits && !atEnd, start: false }} testId="data-table-fade" />
            </div>

            {onLoadMore && (
                <LoadMoreButton
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    onLoadMore={onLoadMore}
                    operationId={operationId}
                />
            )}
        </div>
    );
}
