// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SecLifecycleResponse } from "@/lib/api/types";

import { cikOf, SecFilerMatches } from "@/components/sec/sec-filer-lookup";
import { SecFilerHeader, SecFilingsView, SecLifecycleView } from "@/components/sec/sec-filer-views";
import { ApiRequestError } from "@/lib/api/errors";
import { SEC_FILERS, SEC_FILINGS, SEC_LIFECYCLE_NOT_READY_BODY } from "@/lib/sec/sec-fixtures";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, params, to }: { children: React.ReactNode; params: Record<string, string>; to: string }) => (
        <a href={Object.entries(params).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)}>{children}</a>
    ),
    useNavigate: () => vi.fn(),
}));

vi.mock("@/lib/api/queries", () => ({ useSecFilers: vi.fn() }));

afterEach(cleanup);

describe("tickerless filer selection", () => {
    it("a typed CIK goes to its page (leading zeros dropped); a name is a search", () => {
        expect(cikOf("0000320193")).toBe("320193");

        expect(cikOf("Berkshire")).toBeNull();

        expect(cikOf("0")).toBeNull();
    });

    it("name matches link to /sec/$cik — a filer without a ticker included, labelled 'No ticker'", () => {
        render(<SecFilerMatches data={SEC_FILERS} error={null} isLoading={false} />);

        expect(screen.getByRole("link", { name: "3LP Appleton Industrial MM LLC" })).toHaveAttribute("href", "/sec/2063464");

        expect(screen.getAllByText("No ticker")).toHaveLength(2);

        expect(screen.getAllByText("needs review")).toHaveLength(2);
    });

    it("the header of a tickerless filer says so and invents no ticker", () => {
        const data = {
            api_schema: "secdoors.v1",
            filer: { cik: "2063464", cik10: "0002063464", name: "Acme SPAC Corp", stated_tickers: [] },
            readiness: { reason: null, recoverable: false, status: "ready" as const },
        };

        render(<SecFilerHeader cik="2063464" data={data} error={null} isLoading={false} />);

        expect(screen.getByText("Acme SPAC Corp")).toBeInTheDocument();

        expect(screen.getByText("No ticker")).toBeInTheDocument();
    });
});

describe("SecLifecycleView", () => {
    it("the live 503 not_ready: 'Issuer lifecycle is not switched on yet', nothing listed", () => {
        const error = new ApiRequestError(503, {
            code: "issuer_lifecycle_provider_not_registered",
            error: "not_ready",
            message: "This SEC store capability is not switched on yet.",
            readiness: { reason: "issuer_lifecycle_provider_not_registered", status: "not_ready" },
        });

        render(<SecLifecycleView data={null} error={error} isLoading={false} />);

        expect(SEC_LIFECYCLE_NOT_READY_BODY.code).toBe("issuer_lifecycle_provider_not_registered");

        expect(screen.getByText("Issuer lifecycle is not switched on yet")).toBeInTheDocument();

        expect(screen.queryByText("Registration tracks")).toBeNull();
    });

    it("tracks and successor evidence state their review status explicitly", () => {
        const data: SecLifecycleResponse = {
            api_schema: "secdoors.v1",
            decision: { reason: "public_preipo", status: "eligible" },
            issuer: { kind: "operating", phase: "public_preipo" },
            readiness: { reason: "lifecycle_evidence_pending", recoverable: false, status: "partial" },
            registration_tracks: [{ form: "S-1", stage: "registered", track_key: "333-123456" }],
            successions: { relations: [{ relationship_type: "legal_successor", review_status: "verified", successor_cik: "99" }, { successor_cik: "98" }] },
        };

        render(<SecLifecycleView data={data} error={null} isLoading={false} />);

        expect(screen.getByText("Some lifecycle evidence is still being processed")).toBeInTheDocument();

        expect(screen.getByText("333-123456")).toBeInTheDocument();

        expect(screen.getByText("Review status: verified")).toBeInTheDocument();

        expect(screen.getAllByText("Review status: not stated")).toHaveLength(2);
    });
});

describe("SecFilingsView", () => {
    it("lists the cursor page, filters by the form facet and opens a filing's documents", () => {
        const onOpen = vi.fn();

        render(
            <SecFilingsView
                error={null}
                form={null}
                hasNextPage
                isFetchingNextPage={false}
                isLoading={false}
                onFormChange={() => undefined}
                onMore={() => undefined}
                onOpen={onOpen}
                pages={[SEC_FILINGS]}
            />,
        );

        expect(screen.getByText("0000320193-26-000026")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "More filings" })).toBeInTheDocument();

        fireEvent.click(screen.getAllByRole("button", { name: /Documents/ })[1]);

        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ accession: "0000320193-26-000026", kind: "filing" }));
    });

    it("an excluded filer (403) is its state, not 'No filings'", () => {
        const error = new ApiRequestError(403, { code: "scope_excluded", error: "excluded", message: "x" });

        render(
            <SecFilingsView
                error={error}
                form={null}
                hasNextPage={false}
                isFetchingNextPage={false}
                isLoading={false}
                onFormChange={() => undefined}
                onMore={() => undefined}
                onOpen={() => undefined}
                pages={[]}
            />,
        );

        expect(screen.getByText("Outside the SEC store's coverage")).toBeInTheDocument();

        expect(screen.queryByText("No filings.")).toBeNull();
    });
});
