// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { V2Instrument } from "@/lib/api/types";
import type { ReceivedFiling } from "@/lib/live/live-filings";
import type { FilingListRow } from "@/lib/sec/parity";

import { AAPL_INSTRUMENT } from "@/lib/instruments-fixtures";
import { LIVE_FILING } from "@/lib/sec/filing-detail-fixtures";
import { V2_FILINGS } from "@/lib/sec/v2-fixtures";
import { Route } from "@/routes/$ticker/filings/index";

const state = vi.hoisted(() => ({
    instrument: null as null | V2Instrument,
    live: [] as Array<ReceivedFiling>,
    liveQuery: vi.fn(),
    search: {} as Record<string, unknown>,
}));

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({
        options,
        useNavigate: () => vi.fn(),
        useParams: () => ({ ticker: "AAPL" }),
        useSearch: () => state.search,
    }),
    Link: () => null,
}));

vi.mock("@/lib/api/queries", () => ({
    useCompanyFiscalPeriods: () => ({ data: [] }),
    useInstrument: () => ({ data: state.instrument }),
    useV2FilingsInfinite: () => ({ data: { pages: [V2_FILINGS] }, isLoading: false }),
}));

vi.mock("@/lib/live/live-default", async importOriginal => ({ ...await importOriginal<object>(), useLiveDefault: () => true }));

vi.mock("@/routes/$ticker/filings/-components/use-live-filings-feed", () => ({
    useLiveFilingsFeed: (input: unknown) => {
        state.liveQuery(input);

        // Retained rows deliberately remain available even with enabled=false, as on a route/instrument change.
        return { clearStop: vi.fn(), filings: state.live, mode: "live", stop: null };
    },
}));

vi.mock("@/routes/$ticker/filings/-components/filings-list", () => ({
    FilingsList: ({ displayFilings }: { displayFilings: ReadonlyArray<FilingListRow> }) => <ul>{displayFilings.map(row => <li key={row.accessionNumber}>{row.accessionNumber}</li>)}</ul>,
}));

vi.mock("@/routes/$ticker/filings/-components/filings-header", () => ({ FilingsHeader: ({ actions }: { actions: React.ReactNode }) => <>{actions}</> }));

vi.mock("@/routes/$ticker/filings/-components/html-dialog", () => ({ HtmlDialog: () => null }));

vi.mock("@/components/alerts/create-alert-button", () => ({ AlertEntryPoints: () => null, ENTRY_TYPES: { filings: [] } }));

vi.mock("@/components/live/live-toggle", () => ({ LIVE_FILINGS_PLAN_NOTE: "Live filings", LiveStopNotice: () => null, LiveToggle: () => <button>Live filings</button> }));

vi.mock("@/components/sec/sec-readiness-notice", () => ({ SecReadinessNotice: () => null }));

vi.mock("@/components/sec/sec-source-panel", () => ({ SecSourceDialog: () => null }));

vi.mock("@/components/sec/sec-filing-search", () => ({ SecFilingSearch: () => null }));

const Page = Route.options.component as React.ComponentType;

const historical = { ...AAPL_INSTRUMENT, is_active: false };

const received = (cik: string, accession: string): ReceivedFiling => ({ filing: { ...LIVE_FILING, accession_number: accession, cik }, receivedAt: "2026-11-28T10:00:00Z" });

const ownAccession = "0000320193-26-999991";

const conflictingAccession = "0000009999-26-999992";

beforeEach(() => {
    state.instrument = AAPL_INSTRUMENT;

    state.search = {};

    state.live = [received("0000320193", ownAccession)];

    state.liveQuery.mockClear();
});

afterEach(cleanup);

it("an inactive same-symbol history excludes both conflicting-CIK and own-CIK live frames, including explicit live=true", () => {
    state.instrument = historical;

    state.search = { live: true };

    state.live.push(received("0000009999", conflictingAccession));

    render(<Page />);

    expect(state.liveQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));

    expect(screen.queryByText(ownAccession)).toBeNull();

    expect(screen.queryByText(conflictingAccession)).toBeNull();

    expect(screen.getByText(V2_FILINGS.data[0].accession)).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Live filings" })).toBeNull();
});

it("drops retained frames when the cached instrument becomes inactive", () => {
    const { rerender } = render(<Page />);

    expect(screen.getByText(ownAccession)).toBeInTheDocument();

    state.instrument = historical;

    rerender(<Page />);

    expect(state.liveQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));

    expect(screen.queryByText(ownAccession)).toBeNull();
});

it("keeps a listed instrument's live subscription, rows and toggle", () => {
    render(<Page />);

    expect(state.liveQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));

    expect(screen.getByText(ownAccession)).toBeInTheDocument();

    expect(screen.getByText(V2_FILINGS.data[0].accession)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Live filings" })).toBeInTheDocument();
});
