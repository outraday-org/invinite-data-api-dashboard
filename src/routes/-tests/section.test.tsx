// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HeadingLevelProvider } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

afterEach(cleanup);

describe("Section", () => {
    it("title, description, actions and content; an h2 on a global page", () => {
        render(
            <Section actions={<button type="button">Export</button>} description="Newest first." title="Fiscal periods">
                <p>Rows</p>
            </Section>,
        );

        expect(screen.getByRole("heading", { level: 2, name: "Fiscal periods" })).toBeInTheDocument();

        expect(screen.getByText("Newest first.")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();

        expect(screen.getByText("Rows")).toBeInTheDocument();

        // No box: no border, no background.
        const section = document.querySelector("[data-slot=section]")!;

        expect(section.tagName).toBe("SECTION");

        expect(section.className).not.toMatch(/\bborder\b|\bbg-/);
    });

    it("an h3 under a family header (one step below its PageHeader's h2)", () => {
        render(<HeadingLevelProvider value={2}><Section title="Fiscal periods" /></HeadingLevelProvider>);

        expect(screen.getByRole("heading", { level: 3, name: "Fiscal periods" })).toBeInTheDocument();
    });
});
