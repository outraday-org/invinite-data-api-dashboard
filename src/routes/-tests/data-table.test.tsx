import type { ColumnDef } from "@tanstack/react-table";
// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTable, loadedCountText } from "@/components/ui/data-table";
import { HeadingLevelProvider, PageHeader } from "@/components/ui/page-header";

// The export menu's confirm dialog and plan hints need no query client here.
vi.mock("@/components/api/export-menu", () => ({
    ExportMenu: ({ rows }: { rows: ReadonlyArray<unknown> }) => <button data-rows={rows.length} type="button">Export</button>,
}));

afterEach(cleanup);

type Row = { day: string; name: string };

const COLUMNS: Array<ColumnDef<Row>> = [
    { cell: ({ row }) => row.original.day, header: "Day", id: "day" },
    { cell: ({ row }) => row.original.name, header: "Name", id: "name" },
];

const ROWS: Array<Row> = [
    { day: "Nov 27, 2026", name: "Thanksgiving" },
    { day: "Dec 25, 2026", name: "Christmas" },
];

const table = (props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) => (
    <DataTable columns={COLUMNS} emptyText="No holidays." isLoading={false} rows={ROWS} {...props} />
);

describe("DataTable", () => {
    it("renders the header and one row per item; the header sticks below the pinned page header from lg up", () => {
        render(table());

        expect(screen.getAllByRole("row")).toHaveLength(3);

        expect(screen.getByText("Christmas")).toBeInTheDocument();

        const header = screen.getByText("Day").closest("thead");

        expect(header?.className).toContain("lg:sticky");

        expect(header?.className).toContain("--ticker-header-height");
    });

    it("a table wider than its column keeps its own horizontal scroller: the header is then not window-sticky and the page never scrolls sideways", () => {
        const observed: Array<() => void> = [];

        vi.stubGlobal("ResizeObserver", class {
            constructor(callback: () => void) {
                observed.push(callback);
            }

            disconnect() {}

            observe() {}
        });

        const width = vi.spyOn(HTMLTableElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 1600 } as DOMRect);

        const column = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(900);

        try {
            render(table());

            const header = screen.getByText("Day").closest("thead");

            expect(header?.className ?? "").not.toContain("lg:sticky");

            expect(document.querySelector("[data-slot=table-container]")?.className ?? "").not.toContain("overflow-x-visible");

            expect(observed).toHaveLength(1);
        }
        finally {
            width.mockRestore();

            column.mockRestore();

            vi.unstubAllGlobals();
        }
    });

    it("a table that fits its column lets its wrapper overflow visibly from lg up (the header can stick to the window)", () => {
        render(table());

        expect(document.querySelector("[data-slot=table-container]")?.className).toContain("lg:overflow-x-visible");
    });

    it("skeleton rows while the first page loads; no empty row then", () => {
        render(table({ isLoading: true, rows: [] }));

        expect(screen.getAllByTestId("data-table-skeleton").length).toBeGreaterThan(0);

        expect(screen.queryByText("No holidays.")).toBeNull();
    });

    it("the empty row only for a genuine empty answer", () => {
        const { rerender } = render(table({ rows: [] }));

        expect(screen.getByText("No holidays.")).toBeInTheDocument();

        rerender(table({ emptyIsGenuine: false, rows: [] }));

        expect(screen.queryByText("No holidays.")).toBeNull();
    });

    it("an error row instead of the empty row; rows already loaded stay", () => {
        const { rerender } = render(table({ errorState: <div role="alert">Failed to load</div>, rows: [] }));

        expect(screen.getByRole("alert")).toHaveTextContent("Failed to load");

        expect(screen.queryByText("No holidays.")).toBeNull();

        rerender(table({ errorState: <div role="alert">Failed to load more</div> }));

        expect(screen.getByText("Thanksgiving")).toBeInTheDocument();

        expect(screen.getByRole("alert")).toHaveTextContent("Failed to load more");
    });

    it("\"Load more\" under the table; the count sits in the toolbar (\"N loaded\" while a next page exists, else \"N rows\")", () => {
        const onLoadMore = vi.fn();

        const { rerender } = render(table({ hasNextPage: true, onLoadMore }));

        expect(screen.getByTestId("data-table-count")).toHaveTextContent("2 loaded");

        // The count is in the toolbar, above the table — not beside the button.
        const toolbar = document.querySelector("[data-slot=data-table-toolbar]")!;

        expect(within(toolbar as HTMLElement).getByText("2 loaded")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Load more/ }));

        expect(onLoadMore).toHaveBeenCalledOnce();

        rerender(table({ hasNextPage: false, onLoadMore }));

        expect(screen.queryByRole("button", { name: /Load more/ })).toBeNull();

        expect(screen.getByTestId("data-table-count")).toHaveTextContent("2 rows");

        expect(loadedCountText(1, false)).toBe("1 row");

        expect(loadedCountText(1200, true)).toBe("1,200 loaded");
    });

    it("toolbar: count and meta on the left, Export on the right; nothing without export, meta or rows", () => {
        const { rerender } = render(table({ exportConfig: { dataset: "holidays", scope: "market" }, toolbarMeta: <span>Coverage complete</span> }));

        const toolbar = document.querySelector("[data-slot=data-table-toolbar]") as HTMLElement;

        expect(within(toolbar).getByRole("button", { name: "Export" })).toBeInTheDocument();

        expect(within(toolbar).getByText("Coverage complete")).toBeInTheDocument();

        // The toolbar comes before the table (no separate line for the export button).
        expect(toolbar.compareDocumentPosition(document.querySelector("table")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        rerender(table({ rows: [] }));

        expect(document.querySelector("[data-slot=data-table-toolbar]")).toBeNull();

        rerender(table({ exportConfig: { dataset: "holidays", scope: "market" }, rows: [] }));

        expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();

        expect(screen.queryByTestId("data-table-count")).toBeNull();
    });

    it("loading: the toolbar keeps its place while the skeleton rows show (no layout jump)", () => {
        render(table({ isLoading: true, rows: [] }));

        expect(document.querySelector("[data-slot=data-table-toolbar]")?.className).toContain("min-h-7");
    });

    it("empty and error rows sit in a 120 px block at 14 px", () => {
        const { rerender } = render(table({ rows: [] }));

        expect(screen.getByText("No holidays.").className).toContain("h-30");

        rerender(table({ errorState: <div role="alert">Failed</div>, rows: [] }));

        expect(screen.getByRole("alert").closest("td")?.className).toContain("h-30");
    });

    it("the first column is font-medium; below 640 px a table of more than 4 columns keeps its first column", () => {
        const wide: Array<ColumnDef<Row>> = ["a", "b", "c", "d", "e"].map(id => ({ cell: ({ row }) => `${id} ${row.original.name}`, header: id, id }));

        const { rerender } = render(table());

        const firstCell = within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0];

        expect(firstCell.className).toContain("font-medium");

        expect(firstCell.className).not.toContain("max-sm:sticky");

        rerender(<DataTable columns={wide} emptyText="None." isLoading={false} rows={ROWS} />);

        expect(within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0].className).toContain("max-sm:sticky");
    });

    it("a sticky first column for wide tables (the wrapper scrolls sideways; the header is then not window-sticky)", () => {
        render(table({ stickyFirstColumn: true }));

        const firstCell = within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0];

        expect(firstCell.className).toContain("sticky");

        expect(screen.getByText("Day").closest("thead")?.className ?? "").not.toContain("lg:sticky");
    });
});

describe("DataTable: columns built again on a render", () => {
    // A page builds its columns in render (`filingColumns({ onOpenHtml, … })`): new templates every time.
    const columnsWithButton = (): Array<ColumnDef<Row>> => [
        { cell: ({ row }) => <button type="button">{`Open ${row.original.name}`}</button>, header: () => <button type="button">Sort</button>, id: "open" },
    ];

    it("keeps the cells mounted: a focused cell or header button keeps focus (F101)", () => {
        const { rerender } = render(<DataTable columns={columnsWithButton()} emptyText="None." isLoading={false} rows={ROWS} />);

        const open = screen.getByRole("button", { name: "Open Christmas" });

        open.focus();

        rerender(<DataTable columns={columnsWithButton()} emptyText="None." isLoading={false} rows={ROWS} />);

        expect(screen.getByRole("button", { name: "Open Christmas" })).toBe(open);

        expect(document.activeElement).toBe(open);

        const sort = screen.getByRole("button", { name: "Sort" });

        rerender(<DataTable columns={columnsWithButton()} emptyText="None." isLoading={false} rows={ROWS} />);

        expect(screen.getByRole("button", { name: "Sort" })).toBe(sort);
    });
});

describe("PageHeader", () => {
    it("an h1 title by default (a global page), the description, the meta line and the actions slot", () => {
        render(<PageHeader actions={<button type="button">Export</button>} description="Cash dividends." meta="31 10-K filings" title="Dividends" />);

        expect(screen.getByRole("heading", { level: 1, name: "Dividends" })).toBeInTheDocument();

        expect(screen.getByText("31 10-K filings")).toHaveAttribute("data-slot", "page-header-meta");

        expect(screen.getByText("Cash dividends.")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();

        // The page's requests live in the top bar's request panel (ui-redesign task 3), not in the header.
        expect(screen.getAllByRole("button")).toHaveLength(1);

        expect(screen.queryByRole("button", { name: /API/ })).toBeNull();
    });

    it("an h2 under a family header (HeadingLevelProvider); an explicit level overrides it", () => {
        const { rerender } = render(<HeadingLevelProvider value={2}><PageHeader title="Dividends" /></HeadingLevelProvider>);

        expect(screen.getByRole("heading", { level: 2, name: "Dividends" })).toBeInTheDocument();

        rerender(<HeadingLevelProvider value={2}><PageHeader level={1} title="Dividends" /></HeadingLevelProvider>);

        expect(screen.getByRole("heading", { level: 1, name: "Dividends" })).toBeInTheDocument();
    });

    it("no actions = no empty actions box", () => {
        render(<PageHeader title="Funds" />);

        expect(document.querySelector("[data-slot=page-header]")?.children).toHaveLength(1);
    });
});
