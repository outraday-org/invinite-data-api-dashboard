// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Stat, statFillClass, StatGrid } from "@/components/ui/stat";

afterEach(cleanup);

describe("StatGrid / Stat", () => {
    it("a description list: label (dt), value and sub-line (dd); 2 / 3 / 4 columns", () => {
        render(
            <StatGrid>
                <Stat label="Market cap" sub="as of Nov 21, 2026" value="$3.95T" />
                <Stat label="Employees" value="164,000" />
            </StatGrid>,
        );

        expect(screen.getByText("Market cap").tagName).toBe("DT");

        expect(screen.getByText("$3.95T").tagName).toBe("DD");

        expect(screen.getByText("as of Nov 21, 2026").tagName).toBe("DD");

        const list = document.querySelector("dl")!;

        expect(list.className).toContain("grid-cols-2");

        expect(list.className).toContain("sm:grid-cols-3");

        expect(list.className).toContain("xl:grid-cols-4");

        // Hairlines between cells, not one bordered card per value.
        expect(document.querySelectorAll("[data-slot=card]")).toHaveLength(0);

        expect(document.querySelector("[data-slot=stat]")?.className).toContain("border-l");
    });

    it("the last cell fills its row where it would stand alone (2 / 3 / 4 columns); left-out values do not count", () => {
        render(
            <StatGrid>
                <Stat label="A" value="1" />
                <Stat label="B" value="2" />
                {null}
                <Stat label="C" value="3" />
                {false}
                <Stat label="D" value="4" />
                <Stat label="E" value="5" />
            </StatGrid>,
        );

        const cells = document.querySelectorAll("[data-slot=stat]");

        expect(cells).toHaveLength(5);

        // 5 cells: alone on 2 columns and on 4 columns, not on 3 (3 + 2).
        expect(cells[4].className).toContain("max-sm:col-span-2");

        expect(cells[4].className).toContain("xl:col-span-4");

        expect(cells[4].className).not.toContain("sm:max-xl:col-span-3");

        expect(cells[3].className).not.toContain("col-span");

        expect(statFillClass(6)).toBe("");

        expect(statFillClass(7)).toBe("max-sm:col-span-2 sm:max-xl:col-span-3");
    });

    it("no sub-line when none is given", () => {
        render(<StatGrid><Stat label="Employees" value="164,000" /></StatGrid>);

        expect(document.querySelectorAll("dd")).toHaveLength(1);
    });
});
