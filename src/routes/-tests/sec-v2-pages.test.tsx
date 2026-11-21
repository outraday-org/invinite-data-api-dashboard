// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { changePercentText, HolderChangesList, HoldersList, HoldersOverview } from "@/components/sec/holder-views";
import { ApiRequestError } from "@/lib/api/errors";
import { formatDay } from "@/lib/format";
import {
    V2_HOLDER_CHANGES,
    V2_HOLDERS_13F,
    V2_HOLDERS_ISSUER_FILE,
    V2_HOLDERS_NPORT,
    V2_HOLDERS_OVERVIEW,
    V2_HOLDERS_OVERVIEW_NOT_COVERED,
    V2_HOLDERS_PENDING,
    V2_INSIDER_TRADES,
    V2_IPOS,
} from "@/lib/sec/v2-fixtures";
import { insiderRoles, InsiderTradesView } from "@/routes/$ticker/insider-trades/index";
import { ipoIssuerCik, IposView, ipoSymbolText, offerPriceText } from "@/routes/$ticker/ipos/index";

// The page modules' routes need a router; the pure views do not.
vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
}));

// Keep the server functions (TanStack Start) unloaded.
vi.mock("@/lib/api/queries", () => ({
    useV2InsiderTradesInfinite: vi.fn(),
    useV2IposInfinite: vi.fn(),
}));

afterEach(cleanup);

const list = { hasNextPage: false, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

const problem = (status: number, code: string, detail: string) => new ApiRequestError(status, { error: code, message: detail });

describe("Holders, one source (`/v1/holders?source=`)", () => {
    it("13F: the manager, value, the line with coverage through, the snapshot and the counting rule; no fund weight column", () => {
        render(<HoldersList source="13f" state={{ ...list, error: null, pages: [V2_HOLDERS_13F] }} />);

        expect(screen.getByText("VANGUARD GROUP INC")).toHaveAttribute("title", "CIK 0000102909");

        expect(screen.getByText("$412,000,000,000")).toBeInTheDocument();

        expect(screen.queryByText("% of Fund")).toBeNull();

        const line = screen.getByTestId("v2-meta-line");

        expect(within(line).getByText("Complete")).toBeInTheDocument();

        expect(within(line).getByText("through Sep 30, 2026")).toBeInTheDocument();

        expect(within(line).getByText(/^Snapshot /)).toBeInTheDocument();

        expect(within(line).getByText(V2_HOLDERS_13F.meta.counting!)).toBeInTheDocument();
    });

    it("N-PORT: a listed fund links to its page and names its fresher issuer file; an unlisted fund is text only", () => {
        render(<HoldersList source="nport" state={{ ...list, error: null, pages: [V2_HOLDERS_NPORT] }} />);

        expect(screen.getByRole("link", { name: "Vanguard 500 Index Fund" })).toHaveAttribute("href", "/VOO");

        expect(screen.getByText("Issuer file Oct 31, 2026")).toBeInTheDocument();

        expect(screen.getByText("Fidelity Contrafund").closest("a")).toBeNull();

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

        expect(screen.getByText("This SEC capability is not switched on yet")).toBeInTheDocument();

        expect(screen.getByText("The research provider is switched off")).toBeInTheDocument();

        unmount();

        render(<HoldersList source="nport" state={{ ...list, error: problem(404, "not_covered", "Holders of SQQQ cannot be told apart from its trust's other funds yet"), pages: [] }} />);

        expect(screen.getByText("Not known to the SEC store")).toBeInTheDocument();
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

    it("Form 3/4/5 dataset row: transaction date, owner CIK and the derivative flag; a sec-api row shows dashes", () => {
        render(<InsiderTradesView {...list} error={null} pages={[V2_INSIDER_TRADES]} />);

        expect(screen.getByRole("columnheader", { name: "Traded" })).toBeInTheDocument();

        expect(screen.getByRole("columnheader", { name: "Owner CIK" })).toBeInTheDocument();

        const dataset = screen.getByText("Adams Katherine L").closest("tr")!;

        expect(within(dataset).getByText(formatDay("2026-10-15"))).toBeInTheDocument();

        expect(within(dataset).getByText("0001631982")).toBeInTheDocument();

        expect(within(dataset).getByText("Derivative")).toBeInTheDocument();

        const secApi = screen.getByText("Cook Timothy D").closest("tr")!;

        expect(within(secApi).queryByText("Derivative")).toBeNull();

        expect(within(secApi).getAllByText("—").length).toBeGreaterThanOrEqual(3);
    });

    it("roles: every flag in words, 'Other' text kept, none = dash", () => {
        const [trade] = V2_INSIDER_TRADES.data;

        expect(insiderRoles({ ...trade, reporting_person_is_director: true, reporting_person_officer_title: null })).toBe("Director, Officer");

        expect(insiderRoles({ ...trade, reporting_person_is_officer: false, reporting_person_is_other: true, reporting_person_other_text: "Trustee" })).toBe("Trustee");

        expect(insiderRoles({ ...trade, reporting_person_is_officer: false })).toBe("—");
    });

    it("404 not_covered: the not-covered state, no table", () => {
        render(<InsiderTradesView {...list} error={problem(404, "not_covered", "No insider trades are stored for this company")} pages={[]} />);

        expect(screen.getByText("Not known to the SEC store")).toBeInTheDocument();

        expect(screen.queryByRole("table")).toBeNull();
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
