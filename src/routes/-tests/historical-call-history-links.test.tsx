// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { QUALITATIVE_GUIDANCE } from "@/lib/earnings/extraction-fixtures";
import { NVDA_REVENUE_HISTORY } from "@/lib/earnings/o7-earnings-fixtures";
import { GuidanceHistoryPanel } from "@/routes/$ticker/earnings-calls/-components/tabs/guidance-history-panel";
import { KpiHistoryView } from "@/routes/$ticker/earnings-calls/-components/tabs/kpi-history-panel";
import { ComparisonView } from "@/routes/$ticker/earnings-calls/-components/tabs/metrics-diff-tab";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

vi.mock("@/lib/api/queries", () => ({
    useV2GuidanceInfinite: () => ({ data: { pages: [{ data: [{ ...QUALITATIVE_GUIDANCE, company: { ...QUALITATIVE_GUIDANCE.company, ticker: "REUSED" } }] }] } }),
}));

vi.mock("@/lib/api/use-auto-load-pages", () => ({ useAutoLoadPages: () => {} }));

vi.mock("@/components/ui/dialog", () => {
    const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

    return { Dialog: Box, DialogContent: Box, DialogDescription: Box, DialogHeader: Box, DialogTitle: Box };
});

vi.mock("recharts", async importOriginal => ({
    ...await importOriginal<object>(),
    ResponsiveContainer: () => null,
}));

afterEach(cleanup);

it("guidance history keeps the inactive parent ticker instead of the stored event ticker", () => {
    const target = { basis: QUALITATIVE_GUIDANCE.basis, metric: "revenue", periodKind: QUALITATIVE_GUIDANCE.period_kind };

    const { rerender } = render(<GuidanceHistoryPanel company="0001739445" historicalTicker="OLDCO" onClose={vi.fn()} target={target} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", `/OLDCO/earnings-calls/${QUALITATIVE_GUIDANCE.event_id}`);

    rerender(<GuidanceHistoryPanel company="0001739445" onClose={vi.fn()} target={target} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", `/REUSED/earnings-calls/${QUALITATIVE_GUIDANCE.event_id}`);
});

it("KPI history keeps the inactive parent ticker while preserving listed stored-ticker links", () => {
    const mention = { ...NVDA_REVENUE_HISTORY[0], company: { ...NVDA_REVENUE_HISTORY[0].company, ticker: "REUSED" } };

    const props = { company: "0001739445", error: null, isLoading: false, mentions: [mention], onSortChange: vi.fn(), sort: "-conference_date" as const };

    const { rerender } = render(<KpiHistoryView {...props} historicalTicker="OLDCO" />);

    expect(screen.getByRole("link")).toHaveAttribute("href", `/OLDCO/earnings-calls/${mention.event_id}`);

    rerender(<KpiHistoryView {...props} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", `/REUSED/earnings-calls/${mention.event_id}`);
});

it("the prior-call comparison link retains inactive scope without changing its listed default", () => {
    const data: React.ComponentProps<typeof ComparisonView>["data"] = {
        dropped_topics: [],
        event: { cik: "0001739445", conference_date: "2026-10-30T21:00:00Z", event_id: "11111111-1111-4111-8111-111111111111", symbol: "REUSED" },
        hedging: { change: null, level: null },
        new_topics: [],
        numeric_specificity: { change: null, level: null },
        prior_event: { conference_date: "2026-07-30T21:00:00Z", event_id: "22222222-2222-4222-8222-222222222222" },
        similarity: null,
        slide_diff: null,
        summary: null,
        tone_shift: null,
        uncertainty: { change: null, level: null },
    };

    const { rerender } = render(<ComparisonView data={data} error={null} historicalTicker="OLDCO" isLoading={false} symbol="REUSED" />);

    expect(screen.getByRole("link")).toHaveAttribute("href", `/OLDCO/earnings-calls/${data.prior_event?.event_id}`);

    rerender(<ComparisonView data={data} error={null} isLoading={false} symbol="REUSED" />);

    expect(screen.getByRole("link")).toHaveAttribute("href", `/REUSED/earnings-calls/${data.prior_event?.event_id}`);
});
