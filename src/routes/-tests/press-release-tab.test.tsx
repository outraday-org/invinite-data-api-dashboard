// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CallTabProps } from "@/routes/$ticker/earnings-calls/-components/call-tabs";

import { useV2PressRelease } from "@/lib/api/queries";
import { PressReleaseTab } from "@/routes/$ticker/earnings-calls/-components/tabs/press-release-tab";

vi.mock("@tanstack/react-router", () => ({
    // The news link opens the News page with its item panel: the mock shows where it goes.
    Link: ({ children, params, search, to }: { children: React.ReactNode; params: { ticker: string }; search: { item: string }; to: string }) => (
        <a href={`${to.replace("$ticker", params.ticker)}?item=${search.item}`}>{children}</a>
    ),
}));

vi.mock("@/lib/api/queries", () => ({ useV2PressRelease: vi.fn() }));

afterEach(cleanup);

const RELEASE = {
    accession_number: null,
    body_text: "NVIDIA reported record revenue.",
    event_id: "e1",
    news_id: "4c1d9e62-3b7a-4f2e-8d1c-9e0a7b6c5d4f",
    origin: "ir_page",
    participants: null,
    published_at: "2026-11-19T21:20:00.000Z",
    title: "NVIDIA Announces Financial Results",
    trust_tier: "confirmed_domain",
    url: "https://nvidianews.nvidia.com/news/q3",
};

const props = { event: { cik: "1045810", symbol: "NVDA" }, eventId: "e1" } as unknown as CallTabProps;

describe("PressReleaseTab", () => {
    it("links the archival news item (the News page's item panel) when the release has one", () => {
        vi.mocked(useV2PressRelease).mockReturnValue({ data: RELEASE, error: null } as never);

        render(<PressReleaseTab {...props} />);

        expect(screen.getByRole("link", { name: "News item" })).toHaveAttribute("href", `/NVDA/news?item=${RELEASE.news_id}`);
    });

    it("names the origin and trust tier in words, not codes (UI walk F062)", () => {
        vi.mocked(useV2PressRelease).mockReturnValue({ data: RELEASE, error: null } as never);

        render(<PressReleaseTab {...props} />);

        expect(screen.getByText("Company IR site")).toBeInTheDocument();

        expect(screen.getByText("Company domain")).toBeInTheDocument();

        expect(screen.queryByText("confirmed_domain")).toBeNull();
    });

    it("shows no news link without a news item", () => {
        vi.mocked(useV2PressRelease).mockReturnValue({ data: { ...RELEASE, news_id: null }, error: null } as never);

        render(<PressReleaseTab {...props} />);

        expect(screen.queryByRole("link", { name: "News item" })).toBeNull();
    });
});
