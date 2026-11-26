// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { V2FilersResponse } from "@/lib/api/types";

import { mergeFilers, rankInstruments, TickerSearch } from "@/components/search/ticker-search";
import { useInstrumentSearch, useV2Filers, useV2PeopleSearch } from "@/lib/api/queries";
import { AAPL_INSTRUMENT, GLD_INSTRUMENT, INSTRUMENT_SEARCH } from "@/lib/instruments-fixtures";
import { PERSON_ANALYST, V2_PEOPLE } from "@/lib/people-fixtures";
import { V2_FILERS } from "@/lib/sec/v2-fixtures";
import { useTickerStore } from "@/lib/stores/ticker-store";

const router = vi.hoisted(() => ({ navigate: vi.fn(), pathname: "/AAPL/financials", ticker: "AAPL" as string | undefined }));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => router.navigate,
    useParams: ({ select }: { select: (params: { ticker?: string }) => string | undefined }) => select({ ticker: router.ticker }),
    useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) => select({ location: { pathname: router.pathname } }),
}));

vi.mock("@/lib/api/queries", () => ({ useInstrumentSearch: vi.fn(), useKeyReady: () => true, useV2Filers: vi.fn(), useV2PeopleSearch: vi.fn() }));

const VANGUARD: V2FilersResponse = {
    ...V2_FILERS,
    data: [
        { ...V2_FILERS.data[0], cik: "0000736054", name: "VANGUARD INDEX FUNDS", phase: "other" },
        { ...V2_FILERS.data[0], cik: "0000102909", forms: ["13F-HR"], name: "VANGUARD GROUP INC", phase: "manager" },
    ],
};

afterEach(cleanup);

beforeEach(() => {
    vi.useFakeTimers();

    router.navigate.mockReset();

    router.pathname = "/AAPL/financials";

    router.ticker = "AAPL";

    useTickerStore.setState({ hasHydrated: true, recents: [] });

    vi.mocked(useInstrumentSearch).mockImplementation((query, types) => ({
        data: query
            ? { ...INSTRUMENT_SEARCH, data: INSTRUMENT_SEARCH.data.filter(instrument => !types || types.includes(instrument.type)) }
            : null,
        isFetching: false,
    }) as never);

    vi.mocked(useV2PeopleSearch).mockImplementation(({ minLength, q }) => ({
        data: q.length >= minLength ? { ...V2_PEOPLE, data: V2_PEOPLE.data.filter(person => person.name.toLowerCase().includes(q.toLowerCase())) } : null,
        isFetching: false,
    }) as never);

    vi.mocked(useV2Filers).mockImplementation(({ phase, q }) => ({
        data: q.length >= 3 ? { ...VANGUARD, data: VANGUARD.data.filter(filer => !phase || filer.phase === phase) } : null,
        isFetching: false,
    }) as never);
});

afterEach(() => {
    vi.useRealTimers();
});

const openSearch = () => {
    render(<TickerSearch />);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    act(() => vi.runOnlyPendingTimers());
};

const type = (text: string) => {
    fireEvent.change(screen.getByRole("combobox"), { target: { value: text } });

    act(() => vi.advanceTimersByTime(400));
};

const option = (label: string) => screen.getAllByTestId("search-option").find(row => within(row).queryByText(label, { selector: "div.font-medium" }))!;

const optionLabels = () => screen.getAllByTestId("search-option").map(row => row.querySelector("div.font-medium")?.textContent);

describe("top-bar search: groups, pills, keyboard, recents", () => {
    it("instruments with their type badges (GLD an ETF trust), institutions & filers (managers first) and pages", () => {
        openSearch();

        type("vanguard");

        // Listed and delisted symbols (Data API 12.0 lists only listed ones by default): an old ticker is still found.
        expect(useInstrumentSearch).toHaveBeenLastCalledWith("vanguard", undefined, { isActive: "all" });

        expect(within(option("GLD")).getAllByTestId("search-badge").map(badge => badge.textContent)).toEqual(["ETF", "Trust"]);

        const labels = optionLabels();

        expect(labels.indexOf("VANGUARD GROUP INC")).toBeLessThan(labels.indexOf("VANGUARD INDEX FUNDS"));

        expect(screen.getByText("Institutions & filers")).toBeInTheDocument();

        fireEvent.click(option("VANGUARD GROUP INC"));

        expect(router.navigate).toHaveBeenLastCalledWith({ params: { cik: "102909" }, to: "/sec/$cik" });
    });

    it("a pill sends only its own request: ETFs + gold = instruments of type etf, no filer request", () => {
        openSearch();

        fireEvent.click(screen.getByRole("tab", { name: "ETFs" }));

        type("gold");

        expect(useInstrumentSearch).toHaveBeenLastCalledWith("gold", ["etf"], { isActive: "all" });

        expect(useV2Filers).toHaveBeenCalledWith(expect.objectContaining({ phase: "manager", q: "" }));

        expect(useV2Filers).toHaveBeenLastCalledWith(expect.objectContaining({ q: "" }));

        expect(optionLabels().every(label => ["GLD", "TQQQ"].includes(label ?? ""))).toBe(true);
    });

    it("Institutions lists filers only; the pill row is a tablist reached by ←/→", () => {
        openSearch();

        const all = screen.getByRole("tab", { name: "All" });

        expect(all).toHaveAttribute("aria-selected", "true");

        fireEvent.keyDown(all, { key: "ArrowLeft" });

        expect(screen.getByRole("tab", { name: "People" })).toHaveAttribute("aria-selected", "true");

        fireEvent.keyDown(screen.getByRole("tab", { name: "People" }), { key: "ArrowLeft" });

        expect(screen.getByRole("tab", { name: "Institutions" })).toHaveAttribute("aria-selected", "true");

        type("vanguard");

        expect(useInstrumentSearch).toHaveBeenLastCalledWith("", undefined, { isActive: "all" });

        expect(optionLabels()).toEqual(["VANGUARD GROUP INC", "VANGUARD INDEX FUNDS"]);
    });

    it("People: a name after the typing pause, from 3 characters; the pill sends no instrument or filer request", () => {
        openSearch();

        type("kramer");

        expect(useV2PeopleSearch).toHaveBeenLastCalledWith({ limit: 5, minLength: 3, q: "kramer" });

        expect(screen.getByText("People", { selector: "[role=presentation]" })).toBeInTheDocument();

        expect(within(option("Richard Kramer")).getAllByTestId("search-badge").map(badge => badge.textContent)).toEqual(["Analyst"]);

        fireEvent.click(screen.getByRole("tab", { name: "People" }));

        expect(useInstrumentSearch).toHaveBeenLastCalledWith("", undefined, { isActive: "all" });

        expect(useV2Filers).toHaveBeenLastCalledWith(expect.objectContaining({ q: "" }));

        expect(optionLabels()).toEqual(["Richard Kramer"]);

        fireEvent.click(option("Richard Kramer"));

        expect(router.navigate).toHaveBeenLastCalledWith({ params: { personId: PERSON_ANALYST.person_id }, to: "/people/$personId" });
    });

    it("an instrument pill sends no people request", () => {
        openSearch();

        fireEvent.click(screen.getByRole("tab", { name: "Stocks" }));

        type("kramer");

        expect(useV2PeopleSearch).toHaveBeenLastCalledWith(expect.objectContaining({ q: "" }));
    });

    it("the pill resets to All on the next open", () => {
        openSearch();

        fireEvent.click(screen.getByRole("tab", { name: "ETNs" }));

        fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });

        act(() => vi.runOnlyPendingTimers());

        cleanup();

        openSearch();

        expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
    });

    it("\"ipo\" offers the IPO calendar page; Enter on it opens the page", () => {
        openSearch();

        type("ipo");

        expect(within(option("IPOs")).getByText("Page")).toBeInTheDocument();
    });

    it("Enter picks the first hit; arrows move the highlight (combobox + listbox)", () => {
        vi.mocked(useInstrumentSearch).mockImplementation(query => ({
            data: query ? { ...INSTRUMENT_SEARCH, data: [AAPL_INSTRUMENT, GLD_INSTRUMENT] } : null,
            isFetching: false,
        }) as never);

        openSearch();

        type("apple");

        const input = screen.getByRole("combobox");

        expect(input).toHaveAttribute("aria-activedescendant", "app-search-option-0");

        fireEvent.keyDown(input, { key: "Enter" });

        // AAPL has financials: the section is kept.
        expect(router.navigate).toHaveBeenLastCalledWith({ href: "/AAPL/financials" });

        cleanup();

        router.navigate.mockReset();

        openSearch();

        type("apple");

        fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });

        fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

        // GLD has no financials: its overview.
        expect(router.navigate).toHaveBeenLastCalledWith({ params: { ticker: "GLD" }, to: "/$ticker" });
    });

    it("Enter before the answer arrived waits for it", () => {
        openSearch();

        fireEvent.change(screen.getByRole("combobox"), { target: { value: "aapl" } });

        fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

        expect(router.navigate).not.toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(400));

        expect(router.navigate).toHaveBeenCalledTimes(1);
    });

    it("empty: the recently opened instruments and institutions", () => {
        useTickerStore.setState({
            hasHydrated: true,
            recents: [
                { badge: "Institution", kind: "filer", label: "VANGUARD GROUP INC", name: "CIK 102909", ref: "102909" },
                { badge: "Stock", kind: "instrument", label: "AAPL", name: "Apple Inc.", ref: "AAPL" },
            ],
        });

        openSearch();

        expect(screen.getByText("Recently opened")).toBeInTheDocument();

        expect(optionLabels()).toEqual(["VANGUARD GROUP INC", "AAPL"]);

        fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

        expect(router.navigate).toHaveBeenLastCalledWith({ params: { cik: "102909" }, to: "/sec/$cik" });
    });

    it("⌘K opens it, also from inside an input", () => {
        render(
            <>
                <input aria-label="other" />
                <TickerSearch />
            </>,
        );

        fireEvent.keyDown(screen.getByLabelText("other"), { key: "k", metaKey: true });

        act(() => vi.runOnlyPendingTimers());

        expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("institutions first, then the other filers, one row per CIK", () => {
        expect(mergeFilers([VANGUARD.data[1]], VANGUARD.data).map(filer => filer.name)).toEqual(["VANGUARD GROUP INC", "VANGUARD INDEX FUNDS"]);
    });

    it("ranks a listed 13F filer (phase public, files_13f) with the managers (UI walk F002)", () => {
        const company = { ...VANGUARD.data[0], cik: "0000000001", files_13f: false, name: "A COMPANY", phase: "public" as const };

        const listedManager = { ...VANGUARD.data[0], cik: "0001067983", files_13f: true, name: "BERKSHIRE HATHAWAY INC", phase: "public" as const };

        expect(mergeFilers([], [company, listedManager]).map(filer => filer.cik)).toEqual(["0001067983", "0000000001"]);
    });
});

describe("rankInstruments", () => {
    it("a typed name: the instrument whose name starts with it before ETFs that mention it", () => {
        const leveraged = { is_active: true, name: "Direxion Daily AAPL Bull 2X Shares", symbol: "AAPU", type: "etf" as const };

        const apple = { is_active: true, name: "Apple Inc.", symbol: "AAPL", type: "stock" as const };

        expect(rankInstruments("apple", [leveraged, apple]).map(hit => hit.symbol)).toEqual(["AAPL", "AAPU"]);

        expect(rankInstruments("aapu", [apple, leveraged]).map(hit => hit.symbol)).toEqual(["AAPU", "AAPL"]);
    });
});
