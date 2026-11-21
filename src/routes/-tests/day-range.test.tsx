// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DayRange } from "@/components/ui/day-range";

afterEach(cleanup);

describe("DayRange (the from / to day pair of every filter row)", () => {
    it("reports only the changed end, a cleared input as undefined", () => {
        const onChange = vi.fn();

        render(<DayRange from="2026-01-01" labels={{ from: "Filed from", to: "Filed to" }} onChange={onChange} to={undefined} />);

        expect(screen.getByLabelText("Filed from")).toHaveProperty("value", "2026-01-01");

        expect(screen.getByLabelText("Filed to")).toHaveProperty("value", "");

        fireEvent.change(screen.getByLabelText("Filed to"), { target: { value: "2026-02-01" } });

        expect(onChange).toHaveBeenLastCalledWith({ to: "2026-02-01" });

        fireEvent.change(screen.getByLabelText("Filed from"), { target: { value: "" } });

        expect(onChange).toHaveBeenLastCalledWith({ from: undefined });
    });

    it("lead, separator, group and titled", () => {
        const { container } = render(
            <div>
                <DayRange from={undefined} group labels={{ from: "Traded from", to: "Traded to" }} lead="Traded" onChange={() => {}} titled to={undefined} />
                <DayRange from={undefined} labels={{ from: "Holidays from", to: "Holidays to" }} lead="Between" onChange={() => {}} separator="and" to={undefined} />
            </div>,
        );

        const [grouped] = container.querySelectorAll("div > span.flex-wrap");

        expect(grouped.textContent).toBe("Tradedto");

        expect(screen.getByLabelText("Traded from").getAttribute("title")).toBe("Traded from");

        expect(screen.getByLabelText("Holidays from").getAttribute("title")).toBeNull();

        expect(container.textContent).toContain("Betweenand");
    });
});
