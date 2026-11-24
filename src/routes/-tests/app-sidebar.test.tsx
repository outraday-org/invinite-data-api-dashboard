// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { ME_PRO } from "@/lib/account-fixtures";
import { useInstrument, useKeyState, useV2Filer, useV2FilingsInfinite, useV2LiveEvents, useV2Person } from "@/lib/api/queries";
import { CALENDAR_EVENT } from "@/lib/earnings/calendar-fixtures";
import { AAPL_INSTRUMENT, SPY_INSTRUMENT, VXX_INSTRUMENT } from "@/lib/instruments-fixtures";
import { PERSON_ANALYST } from "@/lib/people-fixtures";

const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, params = {}, to }: { children: React.ReactNode; params?: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
    useParams: () => route.params,
}));

// The sidebar primitives need a provider and `matchMedia`; plain containers are enough here.
vi.mock("@/components/ui/sidebar", () => {
    const Box = ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>;

    return {
        Sidebar: Box,
        SidebarContent: Box,
        SidebarFooter: Box,
        SidebarGroup: Box,
        SidebarGroupContent: Box,
        SidebarGroupLabel: Box,
        SidebarMenu: Box,
        SidebarMenuItem: Box,
    };
});

vi.mock("@/lib/api/queries", () => ({
    useInstrument: vi.fn(),
    useKeyState: vi.fn(),
    useV2Filer: vi.fn(),
    useV2FilingsInfinite: vi.fn(),
    useV2LiveEvents: vi.fn(),
    useV2Person: vi.fn(),
}));

vi.mock("@/lib/reference/public-status", () => ({ useOverallStatus: () => "degraded" }));

afterEach(cleanup);

beforeEach(() => {
    vi.clearAllMocks();

    route.params = {};

    vi.mocked(useKeyState).mockReturnValue({ me: ME_PRO, state: "ready" });

    vi.mocked(useV2LiveEvents).mockReturnValue({ data: { data: [CALENDAR_EVENT, { ...CALENDAR_EVENT, event_id: "x" }] } } as never);

    vi.mocked(useV2Filer).mockReturnValue({ data: null, isLoading: false } as never);

    vi.mocked(useV2FilingsInfinite).mockReturnValue({ data: null } as never);

    vi.mocked(useInstrument).mockReturnValue({ data: null, error: null, isLoading: false } as never);
});

const contextLinks = () => within(screen.getByTestId("sidebar-context")).getAllByRole("link").map(link => link.textContent);

describe("the sidebar on every page (Market · Browse · Context)", () => {
    it("a tickerless page: Market and Browse, the live count, Help and the account with its plan; no context", () => {
        render(<AppSidebar />);

        const links = screen.getAllByRole("link").map(link => link.textContent);

        expect(links).toEqual(expect.arrayContaining(["Home", "Earnings calendar", "IPOs", "Market holidays", "Funds", "API status", "Licensing"]));

        expect(screen.getByTestId("live-count")).toHaveTextContent("2");

        expect(screen.getByRole("link", { name: /Account/ })).toHaveTextContent("PRO");

        expect(screen.queryByTestId("sidebar-context")).toBeNull();

        expect(screen.getByRole("img", { name: "Partial service disruption" })).toBeInTheDocument();
    });

    it("the public status stays visible while account queries wait for a valid key", () => {
        vi.mocked(useKeyState).mockReturnValue({ me: null, state: "invalid" });

        route.params = { ticker: "AAPL" };

        render(<AppSidebar />);

        expect(useV2LiveEvents).toHaveBeenLastCalledWith(false);

        expect(screen.getByRole("img", { name: "Partial service disruption" })).toBeInTheDocument();

        // No key: no context to load (the page is the onboarding card).
        expect(useInstrument).not.toHaveBeenCalled();

        expect(screen.queryByTestId("sidebar-context")).toBeNull();

        cleanup();

        // While `/v1/me` is checked: the context waits idle.
        vi.mocked(useKeyState).mockReturnValue({ me: null, state: "checking" });

        render(<AppSidebar />);

        expect(useInstrument).toHaveBeenLastCalledWith("");

        expect(screen.getByTestId("context-skeleton")).toBeInTheDocument();
    });

    it("an instrument: its type-labelled context with the sections its datasets allow (Financials one entry)", () => {
        route.params = { ticker: "AAPL" };

        vi.mocked(useInstrument).mockReturnValue({ data: AAPL_INSTRUMENT, error: null, isLoading: false } as never);

        render(<AppSidebar />);

        expect(screen.getByText("AAPL · Stock")).toBeInTheDocument();

        const links = contextLinks();

        expect(links.filter(link => link === "Financials")).toHaveLength(1);

        expect(links).not.toContain("Holdings");

        expect(screen.getByRole("link", { name: "Financials" })).toHaveAttribute("href", "/AAPL/financials");

        cleanup();

        route.params = { ticker: "SPY" };

        vi.mocked(useInstrument).mockReturnValue({ data: SPY_INSTRUMENT, error: null, isLoading: false } as never);

        render(<AppSidebar />);

        expect(contextLinks()).toContain("Holdings");

        expect(contextLinks()).not.toContain("Financials");

        cleanup();

        route.params = { ticker: "VXX" };

        vi.mocked(useInstrument).mockReturnValue({ data: VXX_INSTRUMENT, error: null, isLoading: false } as never);

        render(<AppSidebar />);

        expect(contextLinks()).not.toContain("Financials");

        expect(contextLinks()).not.toContain("Holdings");
    });

    it("skeleton rows while the subject loads", () => {
        route.params = { ticker: "AAPL" };

        vi.mocked(useInstrument).mockReturnValue({ data: null, error: null, isLoading: true } as never);

        render(<AppSidebar />);

        expect(screen.getByTestId("context-skeleton")).toBeInTheDocument();
    });

    it("a filer: its blocks as anchors and its listing", () => {
        route.params = { cik: "0000102909" };

        vi.mocked(useV2Filer).mockReturnValue({
            data: { cik: "102909", fund: null, listing: { exchange: "XNAS", ticker: "VGRD" }, name: "Vanguard Group Inc", phase: "manager", private_offerings: null },
            isLoading: false,
        } as never);

        render(<AppSidebar />);

        expect(useV2Filer).toHaveBeenLastCalledWith("102909", expect.any(Array));

        expect(screen.getByText("Vanguard Group Inc · Institution")).toBeInTheDocument();

        expect(contextLinks()).toEqual(["Profile", "13F portfolio", "Filings", "Open VGRD"]);

        expect(screen.getByRole("link", { name: "13F portfolio" })).toHaveAttribute("href", "#portfolio");
    });

    it("a person: name · role and the page's three blocks as anchors (the page's own `/v1/people/{id}` answer)", () => {
        route.params = { personId: PERSON_ANALYST.person_id.toUpperCase() };

        vi.mocked(useV2Person).mockReturnValue({ data: PERSON_ANALYST, isLoading: false } as never);

        render(<AppSidebar />);

        expect(useV2Person).toHaveBeenLastCalledWith(PERSON_ANALYST.person_id);

        expect(screen.getByText("Richard Kramer · Analyst")).toBeInTheDocument();

        expect(contextLinks()).toEqual(["Profile", "Calls", "Role & firm history"]);

        expect(screen.getByRole("link", { name: "Calls" })).toHaveAttribute("href", "#calls");
    });

    it("a path parameter that is no person id: no person context, no request", () => {
        route.params = { personId: "not-a-person" };

        render(<AppSidebar />);

        expect(useV2Person).not.toHaveBeenCalled();

        expect(screen.queryByTestId("sidebar-context")).toBeNull();
    });
});
