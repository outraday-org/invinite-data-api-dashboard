// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

afterEach(cleanup);

describe("Tabs", () => {
    it("the focusable panel shows the focus outline (F100: it was `outline-none` with nothing in its place)", () => {
        render(
            <Tabs defaultValue="a">
                <TabsList>
                    <TabsTrigger value="a">A</TabsTrigger>
                </TabsList>
                <TabsContent value="a">Panel A</TabsContent>
            </Tabs>,
        );

        const panel = screen.getByRole("tabpanel");

        expect(panel).toHaveAttribute("tabindex", "0");

        expect(panel.className).toMatch(/focus-visible:outline-2/);

        expect(panel.className).toMatch(/focus-visible:outline-primary/);
    });
});
