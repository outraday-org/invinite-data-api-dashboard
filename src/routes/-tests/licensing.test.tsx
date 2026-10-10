// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { LicensingResponse } from "@/lib/api/types";

import { LicensingPageView } from "@/components/licensing/licensing-page-view";
import { ENTERPRISE_TIER, PRICE_PLACEHOLDER } from "@/lib/pricing-posture";

afterEach(cleanup);

const RIGHTS_OFF = { audio: false, display: false, rag: false, redistribute: false, resell: false, train: false };

const LICENSING: LicensingResponse = {
    counsel_signed_off: false,
    families: [
        {
            family: "company",
            routes: [{ license: "display", route: "/v1/company/details", tier: "free" }],
        },
        {
            family: "earnings_calls",
            routes: [
                { license: "display", route: "/v1/earnings-calls/transcript", tier: "lite" },
                { license: "rag", route: "/v1/earnings-calls/audio", tier: "standard" },
            ],
        },
    ],
    notes: {
        audio: "Audio is watermarked per customer.",
        display: "Display note.",
        rag: "RAG note.",
        redistribute: "Redistribute note.",
        sec_data: "SEC data note.",
        train: "Train note.",
    },
    policy_version: "2026-10-01",
    resale: "You may not resell the data as your own data product.",
    rights: ["display", "redistribute", "rag", "train", "audio", "resell"],
    tiers: {
        free: { ...RIGHTS_OFF, display: true },
        lite: { ...RIGHTS_OFF, display: true, rag: true },
        pro: { ...RIGHTS_OFF, audio: true, display: true, rag: true, redistribute: true, resell: true },
        standard: { ...RIGHTS_OFF, audio: true, display: true, rag: true },
    },
    universe: { companies: 6123, earnings_calls: { companies: 500, scope: "top500" } },
};

function renderView(data: LicensingResponse = LICENSING) {
    return render(<LicensingPageView data={data} error={null} isLoading={false} />);
}

describe("LicensingPageView", () => {
    it("shows the draft banner while counsel has not signed off", () => {
        renderView();

        expect(screen.getByText("Draft — pending counsel sign-off")).toBeInTheDocument();

        expect(screen.getByText(/Policy version 2026-10-01/)).toBeInTheDocument();
    });

    it("hides the draft banner once signed off", () => {
        renderView({ ...LICENSING, counsel_signed_off: true });

        expect(screen.queryByText("Draft — pending counsel sign-off")).not.toBeInTheDocument();
    });

    it("renders the matrix with check icons and a dash in every resell cell", () => {
        renderView();

        const matrix = screen.getAllByRole("table")[0];

        const rows = within(matrix).getAllByRole("row");

        expect(rows).toHaveLength(5);

        expect(within(rows[1]).getAllByRole("img", { name: "Included" })).toHaveLength(1);

        // Pro grants resell in the policy, but the column is never a check.
        const proCells = within(rows[4]).getAllByRole("cell");

        expect(within(proCells[proCells.length - 1]).queryByRole("img")).not.toBeInTheDocument();

        expect(within(proCells[proCells.length - 1]).getByText("Not included")).toBeInTheDocument();

        expect(within(rows[4]).getAllByRole("img", { name: "Included" })).toHaveLength(4);
    });

    it("puts the resale callout with the audio note under the matrix", () => {
        renderView();

        const callout = screen.getByText("No resale as your own data").closest("[data-slot=card]");

        if (!(callout instanceof HTMLElement)) throw new Error("no callout card");

        expect(within(callout).getByText(LICENSING.resale)).toBeInTheDocument();

        expect(within(callout).getByText(LICENSING.notes.audio)).toBeInTheDocument();

        expect(screen.getByText(/6,123 US-listed companies in the data sets · earnings calls: the top 500 US companies by market cap/)).toBeInTheDocument();
    });

    it("renders one section per family with its routes and minimum plan", () => {
        renderView();

        const company = screen.getByRole("heading", { level: 3, name: "Company" }).closest("section");

        const earnings = screen.getByRole("heading", { level: 3, name: "Earnings calls" }).closest("section");

        if (!company || !earnings) throw new Error("family sections missing");

        expect(within(company).getByText("/v1/company/details")).toBeInTheDocument();

        expect(within(company).getByText("Free")).toBeInTheDocument();

        expect(within(earnings).getAllByRole("row")).toHaveLength(3);

        expect(within(earnings).getByText("Standard")).toBeInTheDocument();
    });

    it("lists the remaining notes and the pricing posture", () => {
        renderView();

        for (const note of ["Display note.", "Redistribute note.", "RAG note.", "Train note.", "SEC data note."]) {
            expect(screen.getByText(note)).toBeInTheDocument();
        }

        expect(screen.getAllByText(PRICE_PLACEHOLDER)).toHaveLength(3);

        expect(screen.getByText(ENTERPRISE_TIER.name)).toBeInTheDocument();
    });

    it("renders an error state", () => {
        render(<LicensingPageView data={null} error={new Error("down")} isLoading={false} />);

        expect(screen.getByRole("alert")).toHaveTextContent("down");
    });
});
