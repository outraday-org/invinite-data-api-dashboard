// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MacroCatalog } from "@/components/macro/macro-catalog";
import { historyPoints } from "@/components/macro/macro-chart";
import { ScalarMacroPage, TreasuryMacroPage } from "@/components/macro/macro-page";
import { macroSearch } from "@/lib/api/macro";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

const f = vi.hoisted(() => ({
    allows: true,
    catalog: vi.fn(),
    curve: vi.fn(),
    curves: vi.fn(),
    history: vi.fn(),
    me: vi.fn(),
    snapshot: vi.fn(),
}));

vi.mock("@/lib/api/server-functions", async original => ({ ...await original<object>(), getMe: f.me }));

vi.mock("@/lib/api/server-functions-macro", () => ({
    getMacroCatalog: f.catalog,
    getMacroCurves: f.curves,
    getMacroCurveSnapshot: f.curve,
    getMacroHistory: f.history,
    getMacroSnapshot: f.snapshot,
}));

vi.mock("@/components/ui/credit-hint", async original => ({
    ...(await original<object>()),
    usePlanAllows: () => f.allows,
}));

vi.mock("@/components/macro/macro-page-actions", () => ({ MacroPageActions: () => null }));

vi.mock("@tanstack/react-router", async original => ({
    ...(await original<object>()),
    Link: ({ children, search, to }: { to: string; children: React.ReactNode; search?: Record<string, string> }) => (
        <a href={to + "?" + new URLSearchParams(search)}>{children}</a>
    ),
}));

vi.mock("recharts", async orig => ({ ...(await orig<object>()), ResponsiveContainer: () => null }));

const envelope = (data: Array<unknown>, next_cursor: null | string = null) => ({
    data,
    has_more: !!next_cursor,
    meta: {},
    next_cursor,
});

const meta = (series_id: string, label: string, family: string) => ({
    agency: "BLS",
    family,
    first_date: "2010-01-01",
    frequency: "M",
    label,
    last_date: "2026-10-01",
    scale: 1,
    seasonal_adjustment: "SA",
    series_id,
    source_code: "series",
    source_url: "https://www.bls.gov/",
    unit: "index",
});

const mount = (el: React.ReactNode) =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            {el}
        </QueryClientProvider>,
    );

afterEach(cleanup);

beforeEach(() => {
    vi.clearAllMocks();

    f.allows = true;

    f.me.mockResolvedValue({ allowed_families: ["Macro"], plan: "lite" });

    useApiKeyStore.setState({ apiKey: "test-key", hasHydrated: true });

    f.catalog.mockResolvedValue(
        envelope([
            meta("cpi_all_sa", "All items adjusted", "inflation"),
            meta("cpi_all_nsa", "All items unadjusted", "inflation"),
        ]),
    );

    f.snapshot.mockResolvedValue(envelope([]));

    f.history.mockResolvedValue(envelope([]));

    f.curves.mockResolvedValue(envelope([]));

    f.curve.mockResolvedValue(null);
});

describe("keyed macro page requests", () => {
    it("waits for /v1/me, suppresses all four families and the catalog on the old API, and resumes after its response advertises Macro", async () => {
        let answer!: (profile: object) => void;

        f.me.mockReturnValueOnce(new Promise((resolve) => {
            answer = resolve;
        }));

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        render(
            <QueryClientProvider client={client}>
                <MacroCatalog />
                <ScalarMacroPage family="inflation" onChange={vi.fn()} search={{}} />
                <ScalarMacroPage family="labor" onChange={vi.fn()} search={{ view: "history" }} />
                <ScalarMacroPage family="gdp" onChange={vi.fn()} search={{}} />
                <TreasuryMacroPage onChange={vi.fn()} search={{}} />
                <TreasuryMacroPage onChange={vi.fn()} search={{ view: "history" }} />
            </QueryClientProvider>,
        );

        expect(screen.queryByText("US macro data is not available on this API yet")).toBeNull();

        for (const req of [f.catalog, f.snapshot, f.history, f.curve, f.curves])expect(req).not.toHaveBeenCalled();

        answer({ allowed_families: ["Alerts", "Calendar"], plan: "lite" });

        await waitFor(() => expect(screen.getAllByText("US macro data is not available on this API yet")).toHaveLength(6));

        for (const req of [f.catalog, f.snapshot, f.history, f.curve, f.curves])expect(req).not.toHaveBeenCalled();

        fireEvent.click(screen.getAllByRole("button", { name: "Check again" })[0]);

        await waitFor(() => {
            for (const req of [f.catalog, f.snapshot, f.history, f.curve, f.curves]) expect(req).toHaveBeenCalled();
        });

        expect(screen.queryByText("US macro data is not available on this API yet")).toBeNull();

        client.clear();
    });

    it("recognizes a newly selected key with Macro without reusing a legacy account's cached capabilities", async () => {
        f.me.mockImplementation(({ data}: { data: { apiKey: string } }) => Promise.resolve({ allowed_families: data.apiKey === "new-key" ? ["Macro"] : ["Calendar"], plan: "free" }));

        mount(<MacroCatalog />);

        await screen.findByText("US macro data is not available on this API yet");

        expect(f.catalog).not.toHaveBeenCalled();

        act(() => useApiKeyStore.setState({ apiKey: "new-key", apiKeyUpdatedAt: Date.now(), hasHydrated: true }));

        await waitFor(() => expect(f.catalog).toHaveBeenCalledTimes(1));

        expect(f.catalog.mock.calls[0][0].data.apiKey).toBe("new-key");
    });

    it("follows Free catalog cursors and links a tenor from the final page without reading observations", async () => {
        f.allows = false;

        f.catalog
            .mockResolvedValueOnce(envelope([meta("cpi_all_sa", "CPI", "inflation")], "next"))
            .mockResolvedValueOnce(
                envelope([{ ...meta("treasury_par_y30", "30-year Treasury", "yield_curve"), tenor: "y30" }]),
            );

        mount(<MacroCatalog filter="y30" />);

        expect(await screen.findByText("30-year Treasury")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: /30-year Treasury/ })).toHaveAttribute(
            "href",
            "/us-macro/yield-curve?tenor=y30&view=history",
        );

        expect(f.catalog.mock.calls[1]?.[0].data.cursor).toBe("next");

        expect(f.snapshot).not.toHaveBeenCalled();

        expect(f.history).not.toHaveBeenCalled();

        expect(f.curves).not.toHaveBeenCalled();
    });

    it("keeps all paid queries disabled for a Free family deep link", async () => {
        f.allows = false;

        mount(
            <ScalarMacroPage
                family="inflation"
                onChange={() => undefined}
                search={{ series: "cpi_all_nsa", view: "history" }}
            />,
        );

        expect(await screen.findByText(/History and snapshots require Lite/)).toBeInTheDocument();

        await waitFor(() => expect(f.catalog).toHaveBeenCalledTimes(1));

        expect(f.history).not.toHaveBeenCalled();

        expect(f.snapshot).not.toHaveBeenCalled();
    });

    it("uses only the requested scalar series and dates, and preserves an unreported comparison", async () => {
        const r = {
            ...meta("cpi_all_nsa", "All items unadjusted", "inflation"),
            change_1m_pct: 0.1,
            change_12m_pct: null,
            observed_at: "2026-11-24T00:00:00Z",
            published_at: null,
            reference_date: "2026-10-01",
            status: "available",
            value: 337.511,
        };

        f.history.mockResolvedValue(envelope([r]));

        const change = vi.fn();

        mount(
            <ScalarMacroPage
                family="inflation"
                onChange={change}
                search={{ from: "2026-01-01", series: "cpi_all_nsa", to: "2026-10-01", view: "history" }}
            />,
        );

        expect(await screen.findByText("337.511")).toBeInTheDocument();

        expect(f.history.mock.calls[0]?.[0].data).toMatchObject({
            from: "2026-01-01",
            series: "cpi_all_nsa",
            to: "2026-10-01",
        });

        expect(f.snapshot).not.toHaveBeenCalled();

        expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole("button", { name: "Series" }));

        fireEvent.click(await screen.findByRole("menuitemradio", { name: "All items adjusted" }));

        expect(change).toHaveBeenCalledWith({ series: "cpi_all_sa", view: "history" });
    });

    it("keeps different reference periods on GDP and labor snapshots", async () => {
        const base = {
            ...meta("real_gdp_growth", "GDP growth", "gdp"),
            change_prior: 0,
            change_year: 0,
            change_year_pct: null,
            status: "available",
            value: 2,
        };

        f.snapshot.mockResolvedValue(
            envelope([
                { ...base, reference_date: "2026-07-01" },
                { ...base, reference_date: "2026-04-01", series_id: "corporate_profits" },
            ]),
        );

        mount(<ScalarMacroPage family="gdp" onChange={() => undefined} search={{}} />);

        expect(await screen.findByText("2026-04-01")).toBeInTheDocument();

        expect(screen.getByText("2026-07-01")).toBeInTheDocument();

        expect(f.history).not.toHaveBeenCalled();
    });

    it("uses a single exact-date request for an older curve and retains the maturity gap", async () => {
        f.curves.mockResolvedValue(
            envelope([
                {
                    agency: "Treasury",
                    date: "2025-02-14",
                    m1_5: null,
                    observed_at: "2025-02-14T23:00:00Z",
                    source_url: "https://home.treasury.gov/",
                    y10: 4.47,
                },
            ]),
        );

        mount(<TreasuryMacroPage onChange={() => undefined} search={{ date: "2025-02-14", tenor: "m1_5" }} />);

        // The curve row and the maturity table beside the chart both state it.
        expect((await screen.findAllByText("4.47")).length).toBeGreaterThan(0);

        expect(screen.getAllByText("1.5 mo").length).toBeGreaterThan(0);

        expect(f.curves.mock.calls[0]?.[0].data).toMatchObject({ from: "2025-02-14", to: "2025-02-14" });

        expect(f.curve).not.toHaveBeenCalled();
    });

    it("keeps Saturday claims dates and marks missing or explicitly unavailable dates (the line connects across them)", () => {
        expect(macroSearch.parse({ from: "2026-11-14", series: "initial_claims_sa", view: "history" }).from).toBe(
            "2026-11-14",
        );

        expect(
            historyPoints(
                [
                    { label: "2026-11-14", value: 203000 },
                    { label: "2026-10-31", value: null },
                ],
                "W",
            ).map(p => p.value),
        ).toEqual([null, null, 203000]);
    });
});
