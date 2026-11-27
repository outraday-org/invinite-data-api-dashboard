// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AlertEntryPoints, CreateAlertButton, ENTRY_TYPES, entryTypesFor, NON_STOCK_ALERT_TYPES, symbolAlertsText } from "@/components/alerts/create-alert-button";
import { prefilledForm } from "@/lib/alerts/alert-form";
import { ALERT_FILING, ALERT_PRICE } from "@/lib/alerts/alerts-fixtures";
import { AAPL_INSTRUMENT, PDI_INSTRUMENT, SPY_INSTRUMENT } from "@/lib/instruments-fixtures";
import { ALERT_TYPE_CATALOG_FIXTURE } from "@/lib/reference/reference-fixtures";
import { newAlertDescription } from "@/routes/alerts/new";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, search, to, ...rest }: { children: React.ReactNode; search?: Record<string, string>; to: string }) => (
        <a {...rest} href={`${to}${search ? `?${new URLSearchParams(search).toString()}` : ""}`}>{children}</a>
    ),
    Outlet: () => null,
}));

const state = vi.hoisted(() => ({
    count: null as null | { data: Array<unknown>; has_more: boolean },
    countArgs: [] as Array<[string, boolean]>,
    families: ["Alerts"] as Array<string> | null,
    /** The answer's canonical symbol (unset = the mock names none). */
    symbol: undefined as string | undefined,
    type: "stock" as string,
}));

vi.mock("@/lib/api/queries", () => ({
    useAlert: () => ({ data: null }),
    useInstrument: () => ({ data: { datasets: ["profile", "alerts"], symbol: state.symbol, type: state.type } }),
    useKeyState: () => ({ me: state.families ? { allowed_families: state.families } : null }),
    useSymbolAlertCount: (symbol: string, enabled: boolean) => {
        state.countArgs.push([symbol, enabled]);

        return { data: enabled ? state.count : null };
    },
}));

beforeEach(() => {
    state.count = { data: [ALERT_FILING, ALERT_PRICE], has_more: false };

    state.countArgs = [];

    state.families = ["Alerts"];

    state.symbol = undefined;

    state.type = "stock";
});

afterEach(cleanup);

describe("Create alert on ticker pages", () => {
    it("one type = a link to the pre-filled form", () => {
        render(<CreateAlertButton symbol="AAPL" types={ENTRY_TYPES.dividends} />);

        expect(screen.getByRole("link", { name: "Create dividend alert" })).toHaveAttribute("href", "/alerts/new?symbol=AAPL&type=dividend");
    });

    it("several types = a menu; AAPL's news page offers news and news keyword", async () => {
        render(<CreateAlertButton symbol="AAPL" types={ENTRY_TYPES.news} />);

        fireEvent.click(screen.getByRole("button", { name: "Create alert" }));

        await screen.findByRole("menu");

        expect(screen.getAllByRole("menuitem").map(item => item.getAttribute("href"))).toEqual(["/alerts/new?symbol=AAPL&type=news", "/alerts/new?symbol=AAPL&type=news_keyword"]);
    });

    it("the instrument decides: an ETF keeps the types the API takes for it (no news, no earnings, no metrics)", () => {
        expect(entryTypesFor(ENTRY_TYPES.news, SPY_INSTRUMENT)).toEqual([]);

        expect(entryTypesFor(ENTRY_TYPES.calls, SPY_INSTRUMENT)).toEqual(["event_countdown"]);

        expect(entryTypesFor(ENTRY_TYPES.overview, SPY_INSTRUMENT)).toEqual(["price", "price_move", "volume_spike", "price_reminder"]);

        expect(entryTypesFor(ENTRY_TYPES.overview, AAPL_INSTRUMENT)).toContain("fundamental_metric");

        expect(entryTypesFor(ENTRY_TYPES.filings, PDI_INSTRUMENT)).toEqual(["filing", "filing_keyword"]);

        expect(entryTypesFor(ENTRY_TYPES.dividends, undefined)).toEqual([]);
    });

    it("an instrument whose datasets lack `alerts` (the API's table) gets no entry point", () => {
        expect(entryTypesFor(ENTRY_TYPES.overview, { ...AAPL_INSTRUMENT, datasets: AAPL_INSTRUMENT.datasets.filter(dataset => dataset !== "alerts") })).toEqual([]);
    });

    it("\"N alerts on AAPL\" = one page's length, N+ when it has more", () => {
        expect(symbolAlertsText({ data: [ALERT_FILING, ALERT_PRICE], has_more: false }, "AAPL")).toBe("2 alerts on AAPL");

        expect(symbolAlertsText({ data: [ALERT_FILING], has_more: false }, "AAPL")).toBe("1 alert on AAPL");

        expect(symbolAlertsText({ data: Array.from({ length: 100 }, () => ALERT_FILING), has_more: true }, "AAPL")).toBe("100+ alerts on AAPL");

        expect(symbolAlertsText({ data: [], has_more: false }, "AAPL")).toBe("No alert on AAPL");
    });

    it("the entry points: the count links /alerts?symbol= (the API's filter) beside the button", () => {
        render(<AlertEntryPoints symbol="AAPL" types={ENTRY_TYPES.news} />);

        expect(screen.getByTestId("symbol-alerts-link")).toHaveAttribute("href", "/alerts?symbol=AAPL");

        expect(screen.getByTestId("symbol-alerts-link")).toHaveTextContent("2 alerts on AAPL");

        expect(state.countArgs.at(-1)).toEqual(["AAPL", true]);
    });

    it("a lowercase URL (`/aapl`) names the instrument's canonical symbol, in the count, the link and the form (F031)", () => {
        state.symbol = "AAPL";

        render(<AlertEntryPoints symbol="aapl" types={ENTRY_TYPES.overview} />);

        expect(screen.getByTestId("symbol-alerts-link")).toHaveAttribute("href", "/alerts?symbol=AAPL");

        expect(screen.getByTestId("symbol-alerts-link")).toHaveTextContent("2 alerts on AAPL");

        expect(state.countArgs.at(-1)).toEqual(["AAPL", true]);
    });

    it("nothing — and no count request — without the alerts plan, without a key, or on an ETF's news page", () => {
        state.families = ["Companies"];

        const { rerender } = render(<AlertEntryPoints symbol="AAPL" types={ENTRY_TYPES.news} />);

        expect(screen.queryByTestId("alert-entry-points")).toBeNull();

        state.families = null;

        rerender(<AlertEntryPoints symbol="AAPL" types={ENTRY_TYPES.filings} />);

        expect(screen.queryByTestId("alert-entry-points")).toBeNull();

        state.families = ["Alerts"];

        state.type = "etf";

        rerender(<AlertEntryPoints symbol="SPY" types={ENTRY_TYPES.news} />);

        expect(screen.queryByTestId("alert-entry-points")).toBeNull();

        expect(state.countArgs.every(([, enabled]) => !enabled)).toBe(true);
    });
});

describe("/alerts/new pre-fill (`?type=&symbol=&script=&version=&template=`)", () => {
    it("type + symbol into the type's company field", () => {
        expect(prefilledForm("news", "AAPL").condition).toEqual({ symbols: "AAPL" });

        expect(prefilledForm("earnings_results", "AAPL").condition).toEqual({ symbol: "AAPL" });
    });

    it("a script version makes a script alert of it; a template an indicator alert of it", () => {
        const script = prefilledForm(undefined, undefined, { version: "scv_1" });

        expect(script.type).toBe("script");

        expect(script.condition).toEqual({ script_version_id: "scv_1" });

        const indicator = prefilledForm("price", "AAPL", { template: "rsi-cross" });

        expect(indicator).toMatchObject({ indicatorMode: "template", template: { inputs: {}, key: "rsi-cross" }, type: "indicator" });

        expect(indicator.condition).toEqual({ symbol: "AAPL" });
    });

    it("the header says what was pre-filled", () => {
        expect(newAlertDescription({ script: "scr_1", type: "script", version: "scv_1" })).toContain("version scv_1 (script scr_1)");

        expect(newAlertDescription({ template: "rsi-cross", type: "indicator" })).toContain("built-in template rsi-cross");
    });
});

it("ETF entry types match the complete released alert-type catalog fixture", () => {
    expect(ALERT_TYPE_CATALOG_FIXTURE.data).toHaveLength(18);

    expect([...NON_STOCK_ALERT_TYPES].sort()).toEqual(ALERT_TYPE_CATALOG_FIXTURE.data.filter(row => row.subjects.etf).map(row => row.type).sort());
});
