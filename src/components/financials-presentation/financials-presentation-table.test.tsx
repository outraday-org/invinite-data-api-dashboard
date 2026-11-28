// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PresentationPeriod, StandardizedPresentationFactRaw } from "./types";

import { FinancialsPresentationTable } from "./financials-presentation-table";
import { addFactTypes, mergedTreeRows } from "./utils";

vi.mock("@/components/metric-chart/metric-chart-dialog", () => ({
    ChartRowButton: () => null,
    MetricChartDialog: () => null,
}));

vi.mock("@/components/metric-chart/use-chart-selection", () => ({ useChartSelection: () => [null, vi.fn()] }));

vi.mock("@/components/reference/metric-catalog-link", () => ({ MetricCatalogLink: () => null }));

afterEach(cleanup);

const fact = (id: string, value: number, children?: Array<StandardizedPresentationFactRaw>): StandardizedPresentationFactRaw => ({
    children,
    metric_id: id,
    value,
});

const periods: Array<PresentationPeriod> = [
    { facts: [fact("bs_cash_and_cash_equivalents", 53)], label: "Q3 2027", preliminary: true },
    { facts: [fact("bs_total_assets", 200, [fact("bs_cash_and_cash_equivalents", 99), fact("bs_inventory_current", 31)])], label: "Q2 2027" },
    { facts: [fact("bs_total_assets", 180, [fact("bs_inventory_current", 25), fact("bs_goodwill", 8)])], label: "Q1 2027" },
];

describe("Presentation across statement periods", () => {
    it("shows older-only metrics, keeps the full hierarchy and leaves preliminary values missing", () => {
        render(<FinancialsPresentationTable periods={periods} />);

        const inventory = screen.getByText("Inventory Current").closest("tr")!;

        const cells = within(inventory).getAllByRole("cell");

        expect(cells.slice(1).map(cell => cell.textContent)).toEqual(["—", "31.00", "25.00"]);

        expect(screen.getByText("Goodwill")).toBeInTheDocument();

        expect(screen.getAllByText("Cash And Cash Equivalents")).toHaveLength(1);

        expect(within(screen.getByText("Q3 2027").closest("th")!).getByText("Preliminary")).toBeInTheDocument();

        expect(within(screen.getByText("Q2 2027").closest("th")!).queryByText("Preliminary")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));

        expect(screen.queryByText("Inventory Current")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Expand all" }));

        expect(screen.getByText("Inventory Current")).toBeInTheDocument();
    });

    it("deduplicates moved metrics, recomputes parents and supports empty or preliminary-only periods", () => {
        const typed = (facts: Array<StandardizedPresentationFactRaw>) => ({ facts: addFactTypes(facts), preliminary: true });

        const newest = typed([fact("a", 1, [fact("b", 2)])]);

        const older = typed([fact("b", 2, [fact("a", 1), fact("c", 3)])]);

        const rows = mergedTreeRows([typed([]), newest, older]);

        expect(rows.map(row => [row.metricId, row.parentId, row.depth, row.hasChildren])).toEqual([
            ["a", null, 0, true],
            ["b", "a", 1, true],
            ["c", "b", 2, false],
        ]);

        expect(newest.facts[0].children).toHaveLength(1);

        expect(mergedTreeRows([])).toEqual([]);
    });
});
