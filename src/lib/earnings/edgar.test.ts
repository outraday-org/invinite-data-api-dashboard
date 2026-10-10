import { describe, expect, it } from "vitest";

import { edgarFolderUrl } from "./edgar";

describe("edgarFolderUrl", () => {
    it("builds the folder URL without dashes and leading CIK zeros", () => {
        expect(edgarFolderUrl("0000320193", "0000320193-26-000105"))
            .toBe("https://www.sec.gov/Archives/edgar/data/320193/000032019326000105/");
    });

    it("accepts an accession number without dashes", () => {
        expect(edgarFolderUrl("320193", "000032019326000105"))
            .toBe("https://www.sec.gov/Archives/edgar/data/320193/000032019326000105/");
    });

    it("returns null for a missing or malformed part", () => {
        expect(edgarFolderUrl(null, "0000320193-26-000105")).toBeNull();

        expect(edgarFolderUrl("320193", null)).toBeNull();

        expect(edgarFolderUrl("", "0000320193-26-000105")).toBeNull();

        expect(edgarFolderUrl("0", "0000320193-26-000105")).toBeNull();

        expect(edgarFolderUrl("AAPL", "0000320193-26-000105")).toBeNull();

        expect(edgarFolderUrl("320193", "0000320193-26")).toBeNull();
    });
});
