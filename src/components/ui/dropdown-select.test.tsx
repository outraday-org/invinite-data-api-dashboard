// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DropdownMultiSelect, DropdownSelect } from "@/components/ui/dropdown-select";
import { FilterSelect } from "@/components/ui/filter-select";

afterEach(cleanup);

const OPTIONS = [
    { label: "Income Statement", value: "income" },
    { label: "Balance Sheet", value: "balance" },
];

describe("DropdownSelect", () => {
    it("shows the chosen label with the chevron inside the trigger, after a truncating label", () => {
        render(<DropdownSelect aria-label="Statement" className="w-20" onValueChange={vi.fn()} options={OPTIONS} value="balance" />);

        const trigger = screen.getByRole("button", { name: "Statement" });

        expect(trigger).toHaveTextContent("Balance Sheet");

        expect(trigger).toHaveAccessibleDescription("Balance Sheet");

        expect(trigger.className).toMatch(/\binline-flex\b/);

        expect(trigger.className).toMatch(/\bjustify-between\b/);

        expect(trigger.className).toMatch(/\bpx-2\.5\b/);

        const [label, chevron] = Array.from(trigger.children);

        expect(label).toHaveAttribute("data-slot", "dropdown-select-value");

        expect(label.className).toMatch(/\bmin-w-0\b/);

        expect(label.className).toMatch(/\btruncate\b/);

        expect(chevron).toHaveAttribute("data-slot", "dropdown-select-chevron");

        expect(chevron.getAttribute("class")).toMatch(/\bshrink-0\b/);
    });

    it("lists the options with the chosen one checked; choosing another calls onValueChange, the same one nothing", async () => {
        const change = vi.fn();

        render(<DropdownSelect aria-label="Statement" onValueChange={change} options={OPTIONS} value="balance" />);

        fireEvent.click(screen.getByRole("button", { name: "Statement" }));

        expect(await screen.findByRole("menuitemradio", { name: "Balance Sheet" })).toHaveAttribute("aria-checked", "true");

        fireEvent.click(screen.getByRole("menuitemradio", { name: "Balance Sheet" }));

        expect(change).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Statement" }));

        fireEvent.click(await screen.findByRole("menuitemradio", { name: "Income Statement" }));

        expect(change).toHaveBeenCalledWith("income");
    });

    it("closes its menu on Escape (a native button: Enter / Space open it as a click)", async () => {
        render(<DropdownSelect aria-label="Statement" onValueChange={vi.fn()} options={OPTIONS} value="balance" />);

        const trigger = screen.getByRole("button", { name: "Statement" });

        fireEvent.click(trigger);

        const menu = await screen.findByRole("menu");

        fireEvent.keyDown(menu, { key: "Escape" });

        await vi.waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    });

    it("shows the placeholder without a matching option, takes a FilterField label through its id, and disables", () => {
        render(
            <>
                <label htmlFor="pick">Order</label>
                <DropdownSelect disabled id="pick" onValueChange={vi.fn()} options={OPTIONS} placeholder="Pick one" value={undefined} />
            </>,
        );

        const trigger = screen.getByRole("button", { name: "Order" });

        expect(trigger).toHaveTextContent("Pick one");

        expect(trigger).toBeDisabled();
    });

    it("submits its value through a hidden input when named", () => {
        const { container } = render(<form><DropdownSelect aria-label="Statement" name="statement" onValueChange={vi.fn()} options={OPTIONS} value="income" /></form>);

        expect(new FormData(container.querySelector("form") ?? undefined).get("statement")).toBe("income");
    });

    it("FilterSelect is the same picker", () => {
        render(<FilterSelect aria-label="Statement" className="w-40" onValueChange={vi.fn()} options={OPTIONS} value="income" />);

        expect(screen.getByRole("button", { name: "Statement" })).toHaveAttribute("data-slot", "dropdown-select-trigger");
    });
});

describe("DropdownMultiSelect", () => {
    it("toggles options in their listed order and keeps the menu open", async () => {
        const change = vi.fn();

        render(<DropdownMultiSelect aria-label="Series" onValueChange={change} options={OPTIONS} placeholder="All series" value={["balance"]} />);

        const trigger = screen.getByRole("button", { name: "Series" });

        expect(trigger).toHaveAccessibleDescription("Balance Sheet");

        fireEvent.click(trigger);

        fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Income Statement" }));

        expect(change).toHaveBeenCalledWith(["income", "balance"]);

        expect(screen.getByRole("menuitemcheckbox", { name: "Balance Sheet" })).toBeInTheDocument();
    });
});
