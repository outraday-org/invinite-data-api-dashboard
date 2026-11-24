// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { changePercentText, discretionText, HolderChangesList, HoldersList, HoldersOverview, votingText } from "@/components/sec/holder-views";
import { ApiRequestError } from "@/lib/api/errors";
import { formatDay } from "@/lib/format";
import {
    V2_FILER_HOLDING_CHANGES,
    V2_HOLDER_CHANGES,
    V2_HOLDERS_13F,
    V2_HOLDERS_ISSUER_FILE,
    V2_HOLDERS_NPORT,
    V2_HOLDERS_OVERVIEW,
    V2_HOLDERS_OVERVIEW_NOT_COVERED,
    V2_HOLDERS_PENDING,
    V2_INSIDER_HOLDINGS,
    V2_INSIDER_TRADE_DETAIL,
    V2_INSIDER_TRADES,
    V2_IPOS,
} from "@/lib/sec/v2-fixtures";
import {
    insiderHoldingsRequest,
    InsiderHoldingsView,
    insiderRoles,
    InsiderTradeDetailView,
    insiderTradesRequest,
    InsiderTradesView,
    ownerParam,
} from "@/routes/$ticker/insider-trades/index";
import { ipoIssuerCik, IposView, ipoSymbolText, offerPriceText } from "@/routes/ipo-calendar";

// The page modules' routes need a router; the pure views do not.
vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

// Keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    useInsiderTrade: vi.fn(),
    useV2InsiderHoldingsInfinite: vi.fn(),
    useV2InsiderTradesInfinite: vi.fn(),
    useV2IposInfinite: vi.fn(),
}));

afterEach(cleanup);

const list = { hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

const problem = (status: number, code: string, detail: string) => new ApiRequestError(status, { error: code, message: detail });

describe("Holders, one source (`/v1/holders?source=`)", () => {
    it("13F: the manager, value, the line with coverage through, the snapshot and the counting rule; no fund weight column", () => {
        render(<HoldersList source="13f" state={{ ...list, error: null, pages: [V2_HOLDERS_13F] }} />);

        // A 13F manager links its filer page (its portfolio).
        expect(screen.getByRole("link", { name: "VANGUARD GROUP INC" })).toHaveAttribute("href", "/sec/102909");

        expect(screen.getByText("$412,000,000,000")).toBeInTheDocument();

        expect(screen.queryByText("% of Fund")).toBeNull();

        const line = screen.getByTestId("v2-meta-line");

        expect(within(line).getByText("Complete")).toBeInTheDocument();

        expect(within(line).getByText("through Sep 30, 2026")).toBeInTheDocument();

        expect(within(line).getByText(/^Snapshot /)).toBeInTheDocument();

        expect(within(line).getByText(V2_HOLDERS_13F.meta.counting!)).toBeInTheDocument();
    });

    it("N-PORT: a listed fund links to its page and names its fresher issuer file; an unlisted fund is marked and links its trust", () => {
        render(<HoldersList source="nport" state={{ ...list, error: null, pages: [V2_HOLDERS_NPORT] }} />);

        expect(screen.getByRole("link", { name: "Vanguard 500 Index Fund" })).toHaveAttribute("href", "/VOO");

        expect(screen.getByText("Issuer file Oct 31, 2026")).toBeInTheDocument();

        expect(screen.getByText("Fidelity Contrafund").closest("a")).toBeNull();

        const unlisted = screen.getByText("Fidelity Contrafund").closest("tr")!;

        expect(within(unlisted).getByText("Unlisted")).toBeInTheDocument();

        expect(within(unlisted).getByRole("link", { name: "trust" })).toHaveAttribute("href", "/sec/35315");

        expect(screen.getByText("VOO")).toBeInTheDocument();

        expect(screen.getByText("FCNTX")).toBeInTheDocument();

        expect(screen.getByText("7.12%")).toBeInTheDocument();
    });

    it("issuer files: the scope line says it is not every ETF", () => {
        render(<HoldersList source="issuer_file" state={{ ...list, error: null, pages: [V2_HOLDERS_ISSUER_FILE] }} />);

        expect(screen.getByRole("link", { name: "SPDR S&P 500 ETF Trust" })).toHaveAttribute("href", "/SPY");

        expect(screen.getByTestId("holders-note")).toHaveTextContent("7 ETFs — not every ETF");

        cleanup();

        render(<HoldersList source="issuer_file" state={{ ...list, error: null, pages: [{ ...V2_HOLDERS_ISSUER_FILE, data: [] }] }} />);

        expect(screen.getByText("No ETF with an issuer holdings file holds this security.")).toBeInTheDocument();
    });

    it("pending coverage: the pending notice, never 'No institutional holders'", () => {
        render(<HoldersList source="13f" state={{ ...list, error: null, pages: [V2_HOLDERS_PENDING] }} />);

        expect(screen.getByText("Being prepared — asked again in 30 s")).toBeInTheDocument();

        expect(screen.queryByText(/No institutional holders/)).toBeNull();
    });

    it("a complete empty answer is a genuine empty", () => {
        render(<HoldersList source="13f" state={{ ...list, error: null, pages: [{ ...V2_HOLDERS_13F, data: [] }] }} />);

        expect(screen.getByText("No institutional holders reported for this quarter.")).toBeInTheDocument();
    });

    it("503 unavailable and 404 not_covered are states", () => {
        const { unmount } = render(<HolderChangesList state={{ ...list, error: problem(503, "unavailable", "The research provider is switched off"), pages: [] }} />);

        expect(screen.getByText("Not available right now")).toBeInTheDocument();

        expect(screen.getByText("The research provider is switched off")).toBeInTheDocument();

        unmount();

        render(<HoldersList source="nport" state={{ ...list, error: problem(404, "not_covered", "Holders of SQQQ cannot be told apart from its trust's other funds yet"), pages: [] }} />);

        expect(screen.getByText("Not known to the SEC store")).toBeInTheDocument();
    });
});

describe("13F holder columns (Data API 7.0 `Holder` row)", () => {
    it("investment discretion in words, voting authority, the filing's EDGAR page; N-PORT has a filing column, no voting", () => {
        render(<HoldersList source="13f" state={{ ...list, error: null, pages: [V2_HOLDERS_13F] }} />);

        const row = screen.getByText("VANGUARD GROUP INC").closest("tr")!;

        expect(within(row).getByText("Sole")).toBeInTheDocument();

        // Voting authority: three compact numbers, the exact counts as the cell's title and screen-reader text.
        expect(within(row).getByText("Sole 1,390,000,000 · Shared 0 · None 0")).toHaveClass("sr-only");

        expect(within(row).getByText("1.39B")).toBeInTheDocument();

        expect(screen.getByRole("columnheader", { name: "Voting authority (sole, shared, none)" })).toBeInTheDocument();

        // The holder is the first column (pinned while the table is cut).
        expect(within(screen.getAllByRole("row")[0]).getAllByRole("columnheader")[0]).toHaveTextContent("Holder");

        expect(within(row).getByRole("link", { name: "EDGAR" })).toHaveAttribute("href", V2_HOLDERS_13F.data[0].filing_url);

        cleanup();

        render(<HoldersList source="nport" state={{ ...list, error: null, pages: [V2_HOLDERS_NPORT] }} />);

        expect(screen.getByRole("columnheader", { name: "Filing" })).toBeInTheDocument();

        expect(screen.queryByRole("columnheader", { name: "Voting authority (sole, shared, none)" })).toBeNull();

        expect(discretionText("OTR")).toBe("Shared (other)");

        expect(votingText(null)).toBe("—");
    });
});

describe("Holders overview (`/v1/holders` without `source`, owner decision 12)", () => {
    it("one section per source with its own state, as-of and count; rows never merged; 'Show all' opens the source", () => {
        const onShowAll = vi.fn();

        render(<HoldersOverview onShowAll={onShowAll} state={{ ...list, error: null, pages: [V2_HOLDERS_OVERVIEW] }} />);

        const thirteenF = screen.getByTestId("holders-section-13f");

        expect(within(thirteenF).getByText("Institutions (13F)")).toBeInTheDocument();

        expect(within(thirteenF).getByText("as of Sep 30, 2026")).toBeInTheDocument();

        expect(within(thirteenF).getByText("1 shown, more available")).toBeInTheDocument();

        expect(within(thirteenF).getByText("VANGUARD GROUP INC")).toBeInTheDocument();

        expect(within(thirteenF).queryByText("Vanguard 500 Index Fund")).toBeNull();

        const nport = screen.getByTestId("holders-section-nport");

        expect(within(nport).getByText("1 shown of 774")).toBeInTheDocument();

        expect(within(nport).getByText("Vanguard 500 Index Fund")).toBeInTheDocument();

        const issuer = screen.getByTestId("holders-section-issuer_file");

        expect(within(issuer).getByText("1 holder")).toBeInTheDocument();

        expect(within(issuer).queryByRole("button", { name: "Show all" })).toBeNull();

        fireEvent.click(within(nport).getByRole("button", { name: "Show all" }));

        expect(onShowAll).toHaveBeenCalledWith("nport");
    });

    it("a source that cannot answer is a section state with its reason, not a failed page", () => {
        render(<HoldersOverview onShowAll={() => undefined} state={{ ...list, error: null, pages: [V2_HOLDERS_OVERVIEW_NOT_COVERED] }} />);

        const thirteenF = screen.getByTestId("holders-section-13f");

        expect(within(thirteenF).getByText("Not covered")).toBeInTheDocument();

        expect(within(thirteenF).getByText(/own CUSIP is not known yet/)).toBeInTheDocument();

        expect(within(screen.getByTestId("holders-section-nport")).getByText("Unavailable")).toBeInTheDocument();
    });
});

describe("13F changes (`/v1/holder-changes`)", () => {
    it("type label, the fraction as a percent, a null filing date as a dash, partial coverage notice", () => {
        render(<HolderChangesList state={{ ...list, error: null, pages: [V2_HOLDER_CHANGES] }} />);

        const row = screen.getByText("Added").closest("tr")!;

        expect(within(row).getByText("+0.36%")).toBeInTheDocument();

        expect(within(row).getAllByText("—").length).toBeGreaterThan(0);

        expect(screen.getByText("Partly available — what is shown may be incomplete")).toBeInTheDocument();

        expect(changePercentText(1)).toBe("+100%");

        expect(changePercentText(-1)).toBe("-100%");

        expect(changePercentText(null)).toBe("—");
    });

    it("a manager's position changes name the security, the compared quarter and the unit; export + Load more", () => {
        render(<HolderChangesList exportScope="cik-102909" state={{ ...list, error: null, hasNextPage: true, pages: [V2_FILER_HOLDING_CHANGES] }} subject="security" />);

        expect(screen.getByRole("columnheader", { name: "Security" })).toBeInTheDocument();

        expect(screen.queryByRole("columnheader", { name: "Institution" })).toBeNull();

        const sold = screen.getByText("Sold out").closest("tr")!;

        expect(within(sold).getByRole("link", { name: "NVDA" })).toHaveAttribute("href", "/NVDA");

        expect(within(sold).getByText("-100%")).toBeInTheDocument();

        expect(within(sold).getByText(formatDay("2026-06-30"))).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });
});

describe("Insider trades (`/v1/insider-trades`)", () => {
    it("side as Buy / Sell, the officer title, no empty line for a filled page", () => {
        render(<InsiderTradesView {...list} error={null} pages={[V2_INSIDER_TRADES]} />);

        const row = screen.getByText("Cook Timothy D").closest("tr")!;

        expect(within(row).getByText("Sell")).toBeInTheDocument();

        expect(within(row).getByText("Officer (Chief Executive Officer)")).toBeInTheDocument();

        expect(within(row).getByText("$254.12")).toBeInTheDocument();

        expect(screen.queryByText(/No insider trades/)).toBeNull();
    });

    it("Form 3/4/5 dataset row: transaction date, code + derivative marker in one column with a legend; no owner CIK column", () => {
        render(<InsiderTradesView {...list} error={null} pages={[V2_INSIDER_TRADES]} />);

        expect(screen.getByRole("columnheader", { name: "Traded" })).toBeInTheDocument();

        expect(screen.queryByRole("columnheader", { name: "Owner CIK" })).toBeNull();

        expect(screen.queryByRole("columnheader", { name: "Derivative" })).toBeNull();

        const dataset = screen.getByText("Adams Katherine L").closest("tr")!;

        expect(within(dataset).getByText(formatDay("2026-10-15"))).toBeInTheDocument();

        expect(within(dataset).getByText("M")).toHaveAttribute("title", "M · Exercise or conversion of a derivative (exempt)");

        expect(within(dataset).getByText("Deriv.")).toBeInTheDocument();

        const secApi = screen.getByText("Cook Timothy D").closest("tr")!;

        expect(within(secApi).queryByText("Deriv.")).toBeNull();

        expect(within(secApi).getAllByText("—").length).toBeGreaterThanOrEqual(1);

        // The legend names the loaded codes in their first order, then the marker.
        expect(screen.getByTestId("insider-code-legend")).toHaveTextContent("S Open market or private saleM Exercise or conversion of a derivative (exempt)Deriv. a derivative-security line");
    });

    it("a row's Details opens it; the detail shows the 10b5-1 plan, the indirect ownership, the derivative's terms and footnotes", () => {
        const onOpen = vi.fn();

        render(<InsiderTradesView {...list} error={null} onOpen={onOpen} pages={[V2_INSIDER_TRADES]} />);

        fireEvent.click(screen.getByRole("button", { name: "Details of Adams Katherine L's line" }));

        expect(onOpen).toHaveBeenCalledWith(V2_INSIDER_TRADES.data[1]);

        cleanup();

        render(<InsiderTradeDetailView docsLink={<a href="/AAPL/filings">Open the filing</a>} trade={V2_INSIDER_TRADE_DETAIL} />);

        const detail = screen.getByTestId("insider-trade-detail");

        expect(within(detail).getByText("10b5-1 plan").nextSibling).toHaveTextContent("Yes");

        expect(within(detail).getByText("Ownership").nextSibling).toHaveTextContent("Indirect · By Trust");

        expect(within(detail).getByText("Exercise / conversion price").nextSibling).toHaveTextContent("$112.50");

        expect(within(detail).getByText("Expires").nextSibling).toHaveTextContent(formatDay("2031-03-01"));

        expect(within(detail).getByText("Owned before").nextSibling).toHaveTextContent("80,000");

        expect(within(detail).getByText("Owner CIK").nextSibling).toHaveTextContent("0001631982");

        expect(within(detail).getByText(/adopted on May 2, 2026/)).toBeInTheDocument();

        expect(within(detail).getByRole("link", { name: "Open the filing" })).toBeInTheDocument();
    });

    it("a realtime-feed line leaves the dataset's fields out (no row of dashes)", () => {
        render(<InsiderTradeDetailView trade={{ ...V2_INSIDER_TRADES.data[0], shares_owned_before_transaction: null }} />);

        const detail = screen.getByTestId("insider-trade-detail");

        expect(within(detail).queryByText("10b5-1 plan")).toBeNull();

        expect(within(detail).queryByText("Ownership")).toBeNull();

        expect(within(detail).getByText("Source").nextSibling).toHaveTextContent("Realtime Form 4 feed");
    });

    it("roles: every flag in words, 'Other' text kept, none = dash", () => {
        const [trade] = V2_INSIDER_TRADES.data;

        expect(insiderRoles({ ...trade, reporting_person_is_director: true, reporting_person_officer_title: null })).toBe("Director, Officer");

        expect(insiderRoles({ ...trade, reporting_person_is_officer: false, reporting_person_is_other: true, reporting_person_other_text: "Trustee" })).toBe("Trustee");

        expect(insiderRoles({ ...trade, reporting_person_is_officer: false })).toBe("—");
    });

    it("request: a swapped filed / traded range is put in order, days stay days (F045)", () => {
        expect(insiderTradesRequest("AAPL", { from: "2026-11-01", sort: "oldest", tfrom: "2026-11-20", to: "2026-10-01", tto: "2026-11-01" })).toEqual({
            company: "AAPL",
            from: "2026-10-01",
            isDerivative: undefined,
            limit: 50,
            side: undefined,
            sort: "filed_at",
            to: "2026-11-01",
            tradedFrom: "2026-11-01",
            tradedTo: "2026-11-20",
        });

        expect(insiderTradesRequest("AAPL", { from: "2026-10-01", kind: "derivative", side: "sell" })).toMatchObject({ from: "2026-10-01", isDerivative: true, side: "sell", to: undefined });
    });

    it("404 not_covered: the not-covered state, no table", () => {
        render(<InsiderTradesView {...list} error={problem(404, "not_covered", "No insider trades are stored for this company")} pages={[]} />);

        expect(screen.getByText("Not known to the SEC store")).toBeInTheDocument();

        expect(screen.queryByRole("table")).toBeNull();
    });
});

describe("Insider holdings and the owner filter (Data API 11.2)", () => {
    it("holdings: as of, insider, role, security with the derivative marker, held, ownership, exercise price, form", () => {
        render(<InsiderHoldingsView {...list} error={null} hasNextPage pages={[V2_INSIDER_HOLDINGS]} />);

        const cook = screen.getByText("Cook Timothy D").closest("tr")!;

        expect(within(cook).getByText("Officer (Chief Executive Officer)")).toBeInTheDocument();

        expect(within(cook).getByText("3,280,180")).toBeInTheDocument();

        expect(within(cook).getByText("Direct")).toBeInTheDocument();

        const option = screen.getByText("Levinson Arthur D").closest("tr")!;

        expect(within(option).getByText("Deriv.")).toBeInTheDocument();

        expect(within(option).getByText("Indirect · By Trust")).toBeInTheDocument();

        expect(within(option).getByText("$112.50")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });

    it("holdings: 404 not_covered is a state, no table", () => {
        render(<InsiderHoldingsView {...list} error={problem(404, "not_covered", "No insider holdings are stored for this company")} pages={[]} />);

        expect(screen.queryByRole("table")).toBeNull();
    });

    it("owner: digits only, de-duplicated, comma-joined; nothing valid = every insider; both lists send it", () => {
        expect(ownerParam("0001214156, 1214156 1631982")).toBe("1214156,1631982");

        expect(ownerParam("cook")).toBeUndefined();

        expect(insiderTradesRequest("AAPL", { owner: "0001214156" })).toMatchObject({ company: "AAPL", owner: "1214156" });

        expect(insiderHoldingsRequest("AAPL", { kind: "derivative", owner: "1214156", sort: "oldest" })).toEqual({
            company: "AAPL",
            isDerivative: true,
            limit: 50,
            owner: "1214156",
            sort: "as_of",
        });

        expect(insiderHoldingsRequest("AAPL", {})).toMatchObject({ isDerivative: undefined, owner: undefined, sort: undefined });
    });
});

describe("IPOs (`/v1/ipos`, one row per offering)", () => {
    it("stage, exchange MIC, price range or final price, and the registration / listing source badges", () => {
        render(<IposView {...list} error={null} pages={[V2_IPOS]} />);

        const registered = screen.getByText("Rezera Inc").closest("tr")!;

        expect(within(registered).getByText("Price range")).toBeInTheDocument();

        expect(within(registered).getByText("XNAS")).toBeInTheDocument();

        expect(within(registered).getByText("$16.00 – $18.00")).toBeInTheDocument();

        expect(within(registered).getByText("RZRA (proposed)")).toBeInTheDocument();

        expect(within(registered).getByText("Registration")).toBeInTheDocument();

        expect(within(registered).queryByText("Listing")).toBeNull();

        const listed = screen.getByText("NewCo Holdings").closest("tr")!;

        expect(within(listed).getByText("Trading")).toBeInTheDocument();

        expect(within(listed).getByText("XNYS")).toBeInTheDocument();

        expect(within(listed).getByText("$21.00")).toBeInTheDocument();

        expect(within(listed).getByText("NEWCO")).toBeInTheDocument();

        expect(within(listed).getByText("Listing")).toBeInTheDocument();
    });

    it("the issuer links to its SEC filer page (/sec/$cik: identity, filings, Form D private offerings)", () => {
        render(<IposView {...list} error={null} pages={[V2_IPOS]} />);

        expect(screen.getByRole("link", { name: "Rezera Inc" })).toHaveAttribute("href", "/sec/2156369");

        expect(screen.getByRole("link", { name: "NewCo Holdings" })).toHaveAttribute("href", "/sec/1234567");

        const [registration, listing] = V2_IPOS.data;

        expect(ipoIssuerCik({ ...registration, company: null })).toBe("2156369");

        expect(ipoIssuerCik({ ...listing, company: null, sources: { ...listing.sources, registration: null } })).toBeNull();
    });

    it("price and symbol words", () => {
        const [registration, listing] = V2_IPOS.data;

        expect(offerPriceText({ ...registration, price_range_high: null, price_range_low: null })).toBe("—");

        expect(offerPriceText({ ...registration, currency: null, price_range_high: 16, price_range_low: 16 })).toBe("16");

        expect(ipoSymbolText({ ...registration, proposed_symbols: [] })).toBe("—");

        expect(ipoSymbolText({ ...listing, company: null })).toBe("NEWCO");
    });

    it("the plan gate (403 plan_required) is the tier state", () => {
        render(<IposView {...list} error={problem(403, "plan_required", "PRO")} pages={[]} />);

        expect(screen.getByText("STANDARD")).toBeInTheDocument();
    });
});
