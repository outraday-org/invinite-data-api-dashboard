import type { ColumnDef } from "@tanstack/react-table";
// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

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

    it("\"Load more\" with the loaded count while a next page exists", () => {
        const onLoadMore = vi.fn();

        const { rerender } = render(table({ hasNextPage: true, onLoadMore }));

        expect(screen.getByText("2 loaded")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Load more/ }));

        expect(onLoadMore).toHaveBeenCalledOnce();

        rerender(table({ hasNextPage: false, onLoadMore }));

        expect(screen.queryByRole("button", { name: /Load more/ })).toBeNull();
    });

    it("a sticky first column for wide tables (the wrapper scrolls sideways; the header is then not window-sticky)", () => {
        render(table({ stickyFirstColumn: true }));

        const firstCell = within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0];

        expect(firstCell.className).toContain("sticky");

        expect(screen.getByText("Day").closest("thead")?.className ?? "").not.toContain("lg:sticky");
    });
});

describe("PageHeader", () => {
    it("one h2 title, the description and the actions slot", () => {
        render(<PageHeader actions={<button type="button">Export</button>} description="Cash dividends." title="Dividends" />);

        expect(screen.getByRole("heading", { level: 2, name: "Dividends" })).toBeInTheDocument();

        expect(screen.getByText("Cash dividends.")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    });
});
