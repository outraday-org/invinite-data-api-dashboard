import { describe, expect, it } from "vitest";

import { describeEarningsScope, FAMILY_LABELS } from "./labels";

describe("FAMILY_LABELS", () => {
    it("labels the WebSocket and SEC filings families", () => {
        expect(FAMILY_LABELS.websocket).toBe("WebSocket");

        expect(FAMILY_LABELS.sec_filings).toBe("SEC filings");
    });
});

describe("describeEarningsScope", () => {
    it("describes top-N and all, and nothing for unknown", () => {
        expect(describeEarningsScope("top500")).toBe("the top 500 US companies by market cap");

        expect(describeEarningsScope("top1500")).toBe("the top 1,500 US companies by market cap");

        expect(describeEarningsScope("all")).toBe("all US-listed companies");

        expect(describeEarningsScope("unknown")).toBeNull();
    });
});
