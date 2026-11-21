// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DebouncedInput } from "@/components/navigation/debounced-input";

afterEach(() => {
    cleanup();

    vi.useRealTimers();
});

beforeEach(() => {
    vi.useFakeTimers();
});

/** A list page: the committed text lives in its URL (`value`), the field commits after a pause. */
function Page({ initial = "" }: { initial?: string }) {
    const [value, setValue] = React.useState(initial);

    return (
        <>
            <DebouncedInput aria-label="Name" onCommit={setValue} value={value} />
            <button onClick={() => setValue("back")} type="button">back</button>
            <output data-testid="committed">{value}</output>
        </>
    );
}

const field = () => screen.getByLabelText<HTMLInputElement>("Name");

const type = (text: string) => fireEvent.change(field(), { target: { value: text } });

const pause = () => act(() => {
    vi.advanceTimersByTime(300);
});

describe("DebouncedInput", () => {
    it("commits the trimmed text after a pause and keeps the draft as typed (the trailing space stays)", () => {
        render(<Page />);

        type("vanguard ");

        pause();

        expect(screen.getByTestId("committed")).toHaveTextContent("vanguard");

        expect(field().value).toBe("vanguard ");

        type("vanguard g");

        expect(field().value).toBe("vanguard g");
    });

    it("a value changed from outside (back button) replaces the draft, also after an own commit of the same text", () => {
        render(<Page />);

        type("back");

        pause();

        fireEvent.click(screen.getByRole("button", { name: "back" }));

        expect(field().value).toBe("back");

        act(() => {
            fireEvent.change(field(), { target: { value: "other" } });
        });

        pause();

        fireEvent.click(screen.getByRole("button", { name: "back" }));

        expect(field().value).toBe("back");
    });
});
