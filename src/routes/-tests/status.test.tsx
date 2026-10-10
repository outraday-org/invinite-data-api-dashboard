// @vitest-environment jsdom
import type * as React from "react";
import type * as Recharts from "recharts";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { QueryState, StatusPageViewProps } from "@/components/status/status-page-view";
import type { ApiStatusResponse, EarningsCallsStatusResponse, StatusFamily } from "@/lib/api/types";

import { StatusPageView } from "@/components/status/status-page-view";
import { ApiRequestError } from "@/lib/api/errors";

// jsdom has no layout: give recharts a fixed-size box instead of a ResponsiveContainer.
vi.mock("recharts", async importOriginal => ({
    ...await importOriginal<typeof Recharts>(),
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
        <div style={{ height: 300, width: 800 }}>{children}</div>
    ),
}));

afterEach(cleanup);

const STATUS: ApiStatusResponse = {
    api: {
        families: [
            {
                days: [
                    { availability: 1, day: "2026-10-09", failures: 0, p50_ms: 40, p95_ms: 120, requests: 900 },
                    { availability: 0.9995, day: "2026-10-10", failures: 1, p50_ms: 45, p95_ms: 160, requests: 2000 },
                ],
                family: "company",
                last_7d: { availability: 0.99987, p95_ms: 160, requests: 2900 },
            },
            {
                days: [],
                family: "metadata",
                last_7d: { availability: null, p95_ms: null, requests: 0 },
            },
        ],
    },
    earnings_calls: null,
    freshness: [
        { age_hours: 3.2, dataset: "insider_transactions", family: "insider_trades", newest: "2026-10-10T05:00:00Z" },
        { age_hours: null, dataset: "ipos", family: "ipos", newest: null, reason: "no_timestamp" },
        { age_hours: null, dataset: "market_holidays", family: "market", newest: null, reason: "not_measured" },
    ],
    generated_at: "2026-10-10T08:15:00Z",
    measurement: { note: "Measured inside the API process per product family and UTC day." },
    universe: { companies: 6123, earnings_calls: { companies: 500, scope: "top500" } },
    window_days: 30,
};

const EARNINGS: EarningsCallsStatusResponse = {
    coverage: { companies: 500, scope: "top500" },
    coverageDays: [{ coveredLive: 40, coveredReplay24h: 3, day: "2026-10-09", notCovered: 1, total: 44 }],
    days: [
        {
            breaches: ["final"],
            callsLive: 40,
            callsTotal: 44,
            captureSuccessRate: 0.909,
            day: "2026-10-09",
            finalLatencyP50S: 150,
            finalLatencyP95S: 340,
            firstSegmentP50Ms: 9000,
            firstSegmentP95Ms: 18000,
            vendor: "all",
        },
        {
            breaches: [],
            callsLive: 20,
            callsTotal: 21,
            captureSuccessRate: 0.95,
            day: "2026-10-09",
            finalLatencyP50S: 120,
            finalLatencyP95S: 250,
            firstSegmentP50Ms: 8000,
            firstSegmentP95Ms: 15000,
            vendor: "notified",
        },
    ],
    generatedAt: "2026-10-10T06:15:00Z",
    slo: { finalP95S: 300, firstSegmentP95Ms: 30000 },
    summary: {
        last7d: { captureSuccessRate: 0.909, coveredLiveRate: 0.8, finalLatencyP95S: 340, firstSegmentP95Ms: 18000 },
    },
    vendors: ["all", "notified"],
    windowDays: 30,
};

function loaded<T>(data: T): QueryState<T> {
    return { data, error: null, isLoading: false };
}

function renderView(overrides: Partial<StatusPageViewProps> = {}) {
    return render(
        <StatusPageView
            days={30}
            earnings={loaded(EARNINGS)}
            onDaysChange={vi.fn()}
            onVendorChange={vi.fn()}
            status={loaded(STATUS)}
            vendor="all"
            {...overrides}
        />,
    );
}

function sectionByHeading(name: string) {
    const section = screen.getByRole("heading", { level: 2, name }).closest("section");

    if (!section) throw new Error(`no section ${name}`);

    return section;
}

describe("StatusPageView", () => {
    it("renders the header with the universe and the earnings scope", () => {
        renderView();

        expect(screen.getByRole("heading", { level: 1, name: "API status" })).toBeInTheDocument();

        expect(screen.getByText("6,123 US-listed companies")).toBeInTheDocument();

        expect(screen.getByText(/Covering the top 500 US companies by market cap/)).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
    });

    it("lists one row per measured family plus the WebSocket note", () => {
        renderView();

        const table = within(sectionByHeading("API")).getAllByRole("table")[0];

        const rows = within(table).getAllByRole("row");

        expect(rows).toHaveLength(4);

        expect(within(rows[1]).getByText("Company")).toBeInTheDocument();

        expect(within(rows[1]).getByText("99.99%")).toBeInTheDocument();

        expect(within(rows[1]).getByText("160 ms")).toBeInTheDocument();

        expect(within(rows[1]).getByText("2,900")).toBeInTheDocument();

        expect(within(rows[2]).getByText("Metadata")).toBeInTheDocument();

        expect(within(rows[2]).getAllByText("—")).toHaveLength(2);

        expect(within(rows[3]).getByText(/WebSocket: not measured here; live earnings-call delivery is covered by the pipeline section/)).toBeInTheDocument();

        expect(screen.getByText(STATUS.measurement.note)).toBeInTheDocument();
    });

    it("shows the freshness table with reason texts instead of dates", () => {
        renderView();

        const section = sectionByHeading("Data freshness");

        expect(within(section).getByText("Insider transactions")).toBeInTheDocument();

        expect(within(section).getByText("Oct 10, 2026, 5:00 AM UTC")).toBeInTheDocument();

        expect(within(section).getByText("3.2 h")).toBeInTheDocument();

        expect(within(section).getByText("no ingest timestamp")).toBeInTheDocument();

        expect(within(section).getByText("not measured yet")).toBeInTheDocument();
    });

    it("shows the earnings stat cards and the day table of the selected vendor", () => {
        renderView();

        const section = sectionByHeading("Earnings calls");

        expect(within(section).getByText("First segment p95 (7 d)")).toBeInTheDocument();

        expect(within(section).getAllByText("18.0 s").length).toBeGreaterThan(0);

        expect(within(section).getAllByText("340.0 s").length).toBeGreaterThan(0);

        expect(within(section).getAllByText("90.9%").length).toBeGreaterThan(0);

        expect(within(section).getByText("80.0%")).toBeInTheDocument();

        expect(within(section).getByText("First live segment p95 ≤ 30 s after call start")).toBeInTheDocument();

        expect(within(section).getByText("Final transcript p95 ≤ 300 s after call end")).toBeInTheDocument();

        expect(within(section).getByText("final transcript")).toBeInTheDocument();
    });

    it("shows only the API panel when request statistics are unavailable", () => {
        renderView({ status: loaded({ ...STATUS, api: null }) });

        expect(screen.getByText("Request statistics unavailable")).toBeInTheDocument();

        expect(within(sectionByHeading("Data freshness")).getByText("Insider transactions")).toBeInTheDocument();
    });

    it("says no requests were measured when every family is empty", () => {
        renderView({
            status: loaded({
                ...STATUS,
                api: { families: [{ days: [], family: "company", last_7d: { availability: null, p95_ms: null, requests: 0 } }] },
            }),
        });

        expect(screen.getByText("No requests measured yet")).toBeInTheDocument();
    });

    it("appends a family the dashboard does not know yet instead of dropping it", () => {
        // A family newer than this build's schema: parsed, not cast, so the fixture stays honest.
        const unknown: StatusFamily = JSON.parse(
            "{\"family\":\"options_chain\",\"days\":[],\"last_7d\":{\"availability\":0.5,\"p95_ms\":10,\"requests\":2}}",
        );

        renderView({ status: loaded({ ...STATUS, api: { families: [unknown, ...(STATUS.api?.families ?? [])] } }) });

        const rows = within(within(sectionByHeading("API")).getAllByRole("table")[0]).getAllByRole("row");

        expect(within(rows[3]).getByText("options_chain")).toBeInTheDocument();

        expect(within(rows[3]).getByText("50.00%")).toBeInTheDocument();
    });

    it("shows an error and the freshness panel when the /status request itself failed", () => {
        renderView({ status: { data: null, error: new Error("network down"), isLoading: false } });

        expect(within(sectionByHeading("API")).getByRole("alert")).toHaveTextContent("network down");

        expect(within(sectionByHeading("Data freshness")).getByText("Freshness unavailable")).toBeInTheDocument();
    });

    it("lists the coverage counters next to the coverage chart", () => {
        renderView();

        const table = screen.getByRole("table", { name: "Coverage per day" });

        const cells = within(within(table).getAllByRole("row")[1]).getAllByRole("cell").map(cell => cell.textContent);

        expect(cells).toEqual(["2026-10-09", "44", "40", "3", "1"]);
    });

    it("shows the freshness panel when freshness is unavailable", () => {
        renderView({ status: loaded({ ...STATUS, freshness: null }) });

        expect(screen.getByText("Freshness unavailable")).toBeInTheDocument();
    });

    it("says no measurements yet for an empty earnings replica", () => {
        renderView({ earnings: loaded({ ...EARNINGS, coverageDays: [], days: [] }) });

        expect(screen.getByText("No measurements yet")).toBeInTheDocument();
    });

    it("renders a 503 status_unavailable as not published, not as an error", () => {
        renderView({
            earnings: {
                data: null,
                error: new ApiRequestError(503, { error: "status_unavailable", message: "no SLO" }),
                isLoading: false,
            },
        });

        expect(screen.getByText("Earnings-call status not published for this deployment")).toBeInTheDocument();

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("renders any other earnings failure as an error", () => {
        renderView({
            earnings: {
                data: null,
                error: new ApiRequestError(500, { error: "internal", message: "boom" }),
                isLoading: false,
            },
        });

        expect(screen.getByRole("alert")).toHaveTextContent("boom");
    });
});
