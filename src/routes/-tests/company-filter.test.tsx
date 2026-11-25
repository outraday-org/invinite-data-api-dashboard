// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompanyFilter } from "@/components/search/company-filter";

const search = vi.fn((query: string) => ({
    data: query ? { data: [{ is_active: true, logo_url: null, name: "Microsoft Corporation", symbol: "MSFT", type: "stock" }] } : undefined,
    isFetching: false,
}));

vi.mock("@/lib/api/queries", () => ({ useInstrumentSearch: (query: string) => search(query) }));

afterEach(cleanup);

describe("CompanyFilter", () => {
    it("one chip per company; × clears them", () => {
        const onChange = vi.fn();

        render(<CompanyFilter onChange={onChange} value={["AAPL", "NVDA"]} />);

        expect(screen.getAllByTestId("company-chip").map(chip => chip.textContent)).toEqual(["AAPL", "NVDA"]);

        fireEvent.click(screen.getByRole("button", { name: "Clear companies" }));

        expect(onChange).toHaveBeenCalledWith([]);
    });

    it("the dialog opens on the selected companies; toggles change a draft that Apply hands over", async () => {
        const onChange = vi.fn();

        render(<CompanyFilter onChange={onChange} value={["AAPL", "NVDA"]} />);

        fireEvent.click(screen.getByRole("button", { name: /^Companies: AAPL, NVDA/ }));

        const selected = await screen.findByRole("list", { name: "Selected companies" });

        expect(within(selected).getAllByRole("button", { pressed: true })).toHaveLength(2);

        fireEvent.click(within(selected).getByRole("button", { name: /AAPL/ }));

        expect(onChange).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Apply (1)" }));

        expect(onChange).toHaveBeenCalledWith(["NVDA"]);
    });

    it("a search lists hits to switch on", async () => {
        const onChange = vi.fn();

        render(<CompanyFilter onChange={onChange} value={[]} />);

        fireEvent.click(screen.getByRole("button", { name: /^Companies/ }));

        fireEvent.change(screen.getByLabelText("Search companies"), { target: { value: "micro" } });

        // After the pause before the request.
        fireEvent.click(await within(screen.getByRole("list", { name: "Results" })).findByRole("button", { name: /MSFT/ }));

        fireEvent.click(screen.getByRole("button", { name: "Apply (1)" }));

        expect(onChange).toHaveBeenCalledWith(["MSFT"]);
    });
});
