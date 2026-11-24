// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DayRange } from "@/components/ui/day-range";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";

afterEach(cleanup);

const noop = () => undefined;

const bar = (props: { activeCount?: number; onReset?: () => void } = {}) => (
    <FilterBar {...props}>
        <FilterField label="8-K items">{id => <Input id={id} />}</FilterField>
        <FilterField label="Filed" span={2}>
            <DayRange from={undefined} labels={{ from: "Filed from", to: "Filed to" }} onChange={noop} to={undefined} />
        </FilterField>
        <FilterBar.Trailing><button type="button">Search text</button></FilterBar.Trailing>
    </FilterBar>
);

describe("FilterBar / FilterField", () => {
    it("a render-prop field is a <label> bound to its control; any other field is a group named by its visible label", () => {
        render(bar());

        // Bound by htmlFor: the label names the input.
        expect(screen.getByLabelText("8-K items").tagName).toBe("INPUT");

        // A day range: a group named by the visible label; the date inputs keep their own names.
        expect(screen.getByRole("group", { name: "Filed" })).toBeInTheDocument();

        expect(screen.getByLabelText("Filed from")).toHaveAttribute("type", "date");

        expect(screen.getByRole("group", { name: "Filed" }).className).toContain("sm:col-span-2");

        // Fields align to the top: labels on one line, first controls on the next, beside a taller field too.
        expect(document.querySelector("[data-slot='filter-bar-fields']")?.className).toContain("items-start");

        expect(screen.getByRole("group", { name: "Filters" })).toBeInTheDocument();
    });

    it("no active filter = no reset; an active count shows \"Reset filters\", which calls onReset", () => {
        const onReset = vi.fn();

        const { rerender } = render(bar({ activeCount: 0, onReset }));

        expect(screen.queryByRole("button", { name: /Reset filters/ })).toBeNull();

        rerender(bar({ activeCount: 2, onReset }));

        fireEvent.click(screen.getByRole("button", { name: /Reset filters/ }));

        expect(onReset).toHaveBeenCalledOnce();
    });

    it("phone: a \"Filters · n\" disclosure (CSS-collapsed fields, aria-expanded), the trailing action outside it", () => {
        render(bar({ activeCount: 2, onReset: noop }));

        const toggle = screen.getByRole("button", { name: "Filters · 2" });

        const fields = document.getElementById(toggle.getAttribute("aria-controls")!)!;

        expect(toggle).toHaveAttribute("aria-expanded", "false");

        expect(toggle.className).toContain("sm:hidden");

        expect(fields.className).toContain("max-sm:hidden");

        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute("aria-expanded", "true");

        expect(fields.className).not.toContain("max-sm:hidden");

        // The trailing action is never inside the collapsed part.
        expect(fields.contains(screen.getByRole("button", { name: "Search text" }))).toBe(false);
    });

    it("the toggle reads \"Filters\" without an active filter", () => {
        render(bar());

        expect(screen.getByRole("button", { name: "Filters" })).toHaveAttribute("aria-expanded", "false");
    });

    it("one field: no disclosure on a phone, the field shown inline", () => {
        render(
            <FilterBar>
                <FilterField label="Sort">{id => <Input id={id} />}</FilterField>
            </FilterBar>,
        );

        expect(screen.queryByRole("button", { name: /Filters/ })).toBeNull();

        expect(document.querySelector("[data-slot=filter-bar-fields]")?.className).not.toContain("max-sm:hidden");

        expect(screen.getByLabelText("Sort")).toBeInTheDocument();
    });
});
