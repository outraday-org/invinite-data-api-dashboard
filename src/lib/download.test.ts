import { describe, expect, it } from "vitest";

import { callFileName, callFileStem } from "./download";

describe("callFileName", () => {
    const event = { fiscal_quarter: 3, fiscal_year: 2027, symbol: "NVDA" };

    it("names a call file by symbol, fiscal period and kind", () => {
        expect(callFileName(event, "transcript-v3", "txt")).toBe("NVDA-Q3-FY2027-transcript-v3.txt");

        expect(callFileStem(event, "transcript-v2")).toBe("NVDA-Q3-FY2027-transcript-v2");
    });

    it("leaves out a missing fiscal period", () => {
        expect(callFileName({ ...event, fiscal_year: null }, "transcript", "json")).toBe("NVDA-transcript.json");

        expect(callFileName({ ...event, fiscal_quarter: null }, "call", "mp3")).toBe("NVDA-FY2027-call.mp3");
    });
});
