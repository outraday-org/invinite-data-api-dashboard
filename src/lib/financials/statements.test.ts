import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/export";

import { AAPL_MEMBER_DETAILED, AAPL_MEMBER_SUMMARY, SYNTHETIC_BALANCE_MEMBER_DETAILED } from "./member-fixtures";
import { hasStatement, statementColumns, statementExportRows, statementLines } from "./statements";

describe("flat as-reported statements", () => {
    it("places members before their totals and preserves their own columns and native IDs", () => {
        const row = AAPL_MEMBER_DETAILED.data[0];

        const old = { ...AAPL_MEMBER_SUMMARY.data[0], fiscal_quarter: 2, period_end: "2026-03-28", statements: { income_statement: { facts: {}, member_facts: [] } } };

        const rows = [row, old];

        const lines = statementLines(rows, "income-statement", false);

        const total = lines.findIndex(line => line.id === "RevenueFromContractWithCustomerExcludingAssessedTax");

        const products = lines[total - 2];

        const services = lines[total - 1];

        expect([products.label, services.label]).toEqual(["Products", "Services"]);

        expect(products.values[0]).toMatchObject({ htmlTagId: "f-48", value: 78_678_000_000 });

        expect(products.values[1]).toBeUndefined();

        expect(services.values[0]).toMatchObject({ htmlTagId: "f-52", value: 30_739_000_000 });

        const csv = toCsv(statementExportRows(lines, statementColumns(rows, "income-statement")));

        expect(csv.split("\r\n")[0]).toBe("dimensions,key,label,Q3 2026,Q2 2026");

        expect(csv).toContain(`srt:ProductOrServiceAxis=us-gaap:ProductMember,${products.id},Products,78678000000,\r\n`);
    });

    it("retains a member-only statement and exports zero and quoted captions", () => {
        const row = SYNTHETIC_BALANCE_MEMBER_DETAILED.data[0];

        const source = row.statements.balance_sheet?.member_facts.at(0);

        if (!source) throw new Error("Missing balance-sheet fixture");

        const rows = [{ ...row, statements: { balance_sheet: { facts: {}, member_facts: [{ ...source, company_label: "States, \"US\"", value: 0 }] } } }];

        const lines = statementLines(rows, "balance-sheet", false);

        expect(hasStatement(rows, "balance-sheet")).toBe(true);

        expect(lines).toHaveLength(1);

        expect(statementColumns(rows, "balance-sheet")[0].periodStart).toBeNull();

        expect(toCsv(statementExportRows(lines, statementColumns(rows, "balance-sheet")))).toContain(`${source.key},"States, ""US""",`);

        expect(toCsv(statementExportRows(lines, statementColumns(rows, "balance-sheet")))).toContain(",0\r\n");
    });
});
