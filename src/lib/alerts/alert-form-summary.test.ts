import { describe, expect, it } from "vitest";

import { emptyAlertForm } from "./alert-form";
import { alertFormSummary } from "./alert-form-summary";

describe("alertFormSummary (the form in words)", () => {
    it("a filing alert: the type on its companies, the forms, the delivery", () => {
        const state = { ...emptyAlertForm("filing"), condition: { form_types: "8-K", symbols: "AAPL, MSFT" }, destinationIds: "dst_1" };

        expect(alertFormSummary(state)).toEqual({ details: ["form types 8-K", "delivered to 1 destination"], title: "SEC filing on AAPL, MSFT" });
    });

    it("no company yet, no destination: the type alone and the feed", () => {
        expect(alertFormSummary(emptyAlertForm("filing"))).toEqual({ details: ["event feed and live stream only"], title: "SEC filing" });
    });

    it("many companies are counted; keywords keep their spaces; enums in words; once and the end user named", () => {
        const state = {
            ...emptyAlertForm("earnings_call_keyword"),
            condition: { keywords: "free cash flow\ngross margin", scope: "qna", symbols: "AAPL MSFT NVDA AMZN GOOG" },
            externalUserId: "user_1",
            trigger: { mode: "once" },
        };

        expect(alertFormSummary(state)).toEqual({
            details: ["keywords free cash flow, gross margin", "scope qna", "fires once", "event feed and live stream only", "for end user user_1"],
            title: "Earnings call keyword on AAPL, MSFT, NVDA +2",
        });
    });

    it("a JSON field only says it is set; more than three details are counted", () => {
        const state = {
            ...emptyAlertForm("price_move"),
            condition: { asset_class: "us_stock", baseline: "prior_close", direction: "up", pct: "5", symbol: "AAPL", window_minutes: "30" },
        };

        expect(alertFormSummary(state).details.slice(0, 4)).toEqual(["asset class us stock", "direction up", "move (%) 5", "and 2 more"]);
    });
});
