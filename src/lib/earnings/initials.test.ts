import { describe, expect, it } from "vitest";

import { initialsOf } from "./initials";

describe("initialsOf", () => {
    it("takes the first and the last name", () => {
        expect(initialsOf("Timothy D. Cook")).toBe("TC");

        expect(initialsOf("Colette Kress")).toBe("CK");
    });

    it("drops honorifics, suffixes and folds accents", () => {
        expect(initialsOf("Dr. José Núñez-Pérez, CFA")).toBe("JP");

        expect(initialsOf("Mr. Cook")).toBe("C");

        expect(initialsOf("John Smith Jr.")).toBe("JS");

        expect(initialsOf("Patrick O'Brien")).toBe("PO");
    });

    it("answers null when no letter is left", () => {
        expect(initialsOf("")).toBeNull();

        expect(initialsOf("Mr.")).toBeNull();

        expect(initialsOf("  ")).toBeNull();
    });
});
