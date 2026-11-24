// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageContainer } from "@/components/ui/page-container";

afterEach(cleanup);

describe("PageContainer", () => {
    it.each([
        [undefined, "max-w-[75rem]"],
        ["narrow", "max-w-3xl"],
        ["wide", "max-w-[90rem]"],
    ] as const)("width %s caps the page at %s", (width, maxWidth) => {
        render(<PageContainer data-testid="page" width={width}>Page</PageContainer>);

        const page = screen.getByTestId("page");

        expect(page).toHaveClass(maxWidth, "mx-auto", "min-w-0", "gap-6", "px-4", "sm:px-6", "xl:px-8");

        expect(page).toHaveAttribute("data-slot", "page-container");

        expect(page).toHaveTextContent("Page");
    });

    it("merges a className over its own padding (the ticker layout drops the top padding)", () => {
        render(<PageContainer className="pt-0 sm:pt-0 xl:pt-0" data-testid="page">Page</PageContainer>);

        const page = screen.getByTestId("page");

        expect(page).toHaveClass("pt-0", "sm:pt-0", "xl:pt-0", "py-5", "sm:py-6", "xl:py-8");

        expect(page.className.split(" ").filter(name => name.startsWith("max-w-"))).toEqual(["max-w-[75rem]"]);
    });
});
