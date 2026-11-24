// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { joinTokens, splitTokens, TokenInput } from "./token-input";

afterEach(cleanup);

/** A controlled TokenInput: the caller's text is the only state, as in the alert form. */
function Harness({ initial = "", onValue, separators }: { initial?: string; onValue?: (value: string) => void; separators?: "commas" | "commas-and-spaces" }) {
    const [value, setValue] = React.useState(initial);

    return (
        <>
            <label htmlFor="tokens">Symbols</label>
            <TokenInput
                id="tokens"
                joiner={separators === "commas" ? "\n" : ", "}
                onChange={(next) => {
                    setValue(next);

                    onValue?.(next);
                }}
                separators={separators}
                value={value}
            />
            <output data-testid="value">{value}</output>
        </>
    );
}

describe("splitTokens / joinTokens (the alert form's list rule)", () => {
    it("commas and spaces, or commas and new lines only", () => {
        expect(splitTokens("AAPL, MSFT  NVDA,,", "commas-and-spaces")).toEqual(["AAPL", "MSFT", "NVDA"]);

        expect(splitTokens("free cash flow, gross margin\nguidance", "commas")).toEqual(["free cash flow", "gross margin", "guidance"]);

        expect(joinTokens(["AAPL", "", "MSFT"], ", ")).toBe("AAPL, MSFT");
    });
});

describe("TokenInput", () => {
    it("shows the value's entries as chips; a chip is a button that removes it", () => {
        render(<Harness initial="AAPL, MSFT" />);

        expect(screen.getByRole("button", { name: "Remove AAPL" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Remove AAPL" }));

        expect(screen.getByTestId("value")).toHaveTextContent(/^MSFT$/);

        expect(screen.queryByRole("button", { name: "Remove AAPL" })).toBeNull();
    });

    it("the draft is part of the value; a comma or a space commits it as a chip", () => {
        render(<Harness />);

        const input = screen.getByLabelText("Symbols");

        fireEvent.change(input, { target: { value: "AAPL" } });

        expect(screen.getByTestId("value")).toHaveTextContent(/^AAPL$/);

        expect(screen.queryByRole("button", { name: "Remove AAPL" })).toBeNull();

        fireEvent.change(input, { target: { value: "AAPL " } });

        expect(screen.getByRole("button", { name: "Remove AAPL" })).toBeInTheDocument();

        expect(input).toHaveValue("");

        fireEvent.change(input, { target: { value: "MSFT" } });

        fireEvent.keyDown(input, { key: "Enter" });

        expect(screen.getByRole("button", { name: "Remove MSFT" })).toBeInTheDocument();

        expect(screen.getByTestId("value")).toHaveTextContent("AAPL, MSFT");
    });

    it("a paste splits into chips and keeps the text after the last separator as the draft", () => {
        render(<Harness />);

        const input = screen.getByLabelText("Symbols");

        fireEvent.change(input, { target: { value: "AAPL,MSFT NVDA" } });

        expect(screen.getByRole("button", { name: "Remove AAPL" })).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Remove MSFT" })).toBeInTheDocument();

        expect(input).toHaveValue("NVDA");

        expect(screen.getByTestId("value")).toHaveTextContent("AAPL, MSFT, NVDA");
    });

    it("Backspace in an empty draft removes the last chip", () => {
        render(<Harness initial="AAPL, MSFT" />);

        fireEvent.keyDown(screen.getByLabelText("Symbols"), { key: "Backspace" });

        expect(screen.getByTestId("value")).toHaveTextContent(/^AAPL$/);
    });

    it("commas only: spaces stay inside an entry (keywords)", () => {
        const onValue = vi.fn();

        render(<Harness onValue={onValue} separators="commas" />);

        const input = screen.getByLabelText("Symbols");

        fireEvent.change(input, { target: { value: "free cash flow," } });

        expect(screen.getByRole("button", { name: "Remove free cash flow" })).toBeInTheDocument();

        fireEvent.change(input, { target: { value: "gross margin" } });

        expect(onValue).toHaveBeenLastCalledWith("free cash flow\ngross margin");
    });

    it("Enter with an empty draft is left to the form (submit)", () => {
        const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

        render(
            <form onSubmit={onSubmit}>
                <Harness initial="AAPL" />
            </form>,
        );

        const event = fireEvent.keyDown(screen.getByLabelText("Symbols"), { key: "Enter" });

        // Not prevented: the browser's implicit submission may run.
        expect(event).toBe(true);
    });
});
