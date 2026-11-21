import { describe, expect, it } from "vitest";

import { csvCell, exportFileName, flattenRow, toCsv } from "./export";

describe("toCsv (RFC 4180)", () => {
    it("quotes commas, quotes and line breaks; doubles quotes; CRLF line ends", () => {
        expect(toCsv([{ a: "x,y", b: "say \"hi\"", c: "two\nlines" }])).toBe("a,b,c\r\n\"x,y\",\"say \"\"hi\"\"\",\"two\nlines\"\r\n");
    });

    it("neutralises a text cell that starts like a formula; numbers stay numbers", () => {
        expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");

        expect(csvCell("+1")).toBe("'+1");

        expect(csvCell("-2")).toBe("'-2");

        expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");

        expect(csvCell(-1.5)).toBe("-1.5");

        // A list of plain values is one joined text cell: guarded like a string.
        expect(csvCell(["=cmd()", "b"])).toBe("'=cmd(); b");

        expect(csvCell(["a", "b"])).toBe("a; b");

        expect(csvCell(null)).toBe("");
    });

    it("flattens nested objects with dotted keys; the header is the union of keys in first-seen order", () => {
        const csv = toCsv([
            { id: 1, meta: { source: { url: "https://x" } }, tags: ["a", "b"] },
            { extra: true, id: 2 },
        ]);

        expect(csv.split("\r\n")[0]).toBe("id,meta.source.url,tags,extra");

        expect(csv.split("\r\n")[1]).toBe("1,https://x,a; b,");

        expect(csv.split("\r\n")[2]).toBe("2,,,true");
    });

    it("uses explicit columns when given", () => {
        expect(toCsv([{ n: 1 }], [{ header: "N", value: row => row.n * 2 }])).toBe("N\r\n2\r\n");
    });

    it("keeps an array of objects as JSON", () => {
        expect(flattenRow({ list: [{ a: 1 }] })).toEqual({ list: [{ a: 1 }] });

        expect(csvCell([{ a: 1 }])).toBe("\"[{\"\"a\"\":1}]\"");
    });
});

describe("exportFileName", () => {
    it("is <scope>-<dataset>-<yyyy-mm-dd>.<ext>", () => {
        expect(exportFileName("BRK.B", "insider trades", "csv", new Date("2026-11-21T10:00:00Z"))).toBe("BRK.B-insider-trades-2026-11-21.csv");
    });
});
