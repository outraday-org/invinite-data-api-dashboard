// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchQueryForm } from "@/components/search/search-box";
import { ClearableInput } from "@/components/ui/clearable-input";

afterEach(cleanup);

describe("ClearableInput (the × inside every search field)", () => {
    it("shows the × only while the text is not blank", () => {
        const { rerender } = render(<ClearableInput aria-label="Query" onChange={() => {}} onClear={() => {}} value="" />);

        expect(screen.queryByRole("button", { name: "Clear the search" })).toBeNull();

        rerender(<ClearableInput aria-label="Query" onChange={() => {}} onClear={() => {}} value="   " />);

        expect(screen.queryByRole("button", { name: "Clear the search" })).toBeNull();

        rerender(<ClearableInput aria-label="Query" onChange={() => {}} onClear={() => {}} value="apple" />);

        expect(screen.getByRole("button", { name: "Clear the search" })).toBeTruthy();
    });

    it("the × in a search box empties the draft, resets the search and focuses the field", () => {
        const onClear = vi.fn();

        function Box() {
            const [draft, setDraft] = React.useState("acquisition");

            return <SearchQueryForm busy={false} label="Search the news" onClear={onClear} onSubmit={() => {}} onValueChange={setDraft} placeholder="" value={draft} />;
        }

        render(<Box />);

        fireEvent.click(screen.getByRole("button", { name: "Clear the search" }));

        const input = screen.getByLabelText("Search the news");

        expect(input).toHaveProperty("value", "");

        expect(onClear).toHaveBeenCalledOnce();

        expect(document.activeElement).toBe(input);

        expect(screen.queryByRole("button", { name: "Clear the search" })).toBeNull();
    });
});
