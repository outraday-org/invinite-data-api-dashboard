// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { callFileName, callFileStem, OBJECT_URL_REVOKE_DELAY_MS, saveTextFile } from "./download";

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

describe("saveBlob", () => {
    afterEach(() => {
        vi.useRealTimers();

        vi.restoreAllMocks();
    });

    it("clicks a hidden anchor with the filename and revokes the object URL only after the download started", () => {
        vi.useFakeTimers();

        // jsdom has no object URLs.
        const create = vi.fn(() => "blob:saved");

        const revoke = vi.fn();

        Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });

        const clicked: Array<{ download: string; href: string }> = [];

        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            clicked.push({ download: this.download, href: this.href });
        });

        saveTextFile("hello", "NVDA-transcript.txt");

        expect(clicked).toEqual([{ download: "NVDA-transcript.txt", href: "blob:saved" }]);

        expect(document.querySelector("a[download]")).toBeNull();

        // Revoked at once, a browser still reading the blob fails the save.
        expect(revoke).not.toHaveBeenCalled();

        vi.advanceTimersByTime(OBJECT_URL_REVOKE_DELAY_MS);

        expect(revoke).toHaveBeenCalledWith("blob:saved");
    });
});
