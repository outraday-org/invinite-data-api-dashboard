import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @vitest-environment jsdom
import type { V2Me } from "@/lib/api/types";

import { ME_PAYG, ME_PRO } from "@/lib/account-fixtures";
import { useMe } from "@/lib/api/queries";

import { PlanBadge, tierLabel } from "./credit-hint";

vi.mock("@/lib/api/queries", () => ({ useMe: vi.fn() }));

afterEach(cleanup);

function badgeFor(me: V2Me, operationId: Parameters<typeof PlanBadge>[0]["operationId"]) {
    vi.mocked(useMe).mockReturnValue({ data: me } as ReturnType<typeof useMe>);

    return render(
        <QueryClientProvider client={new QueryClient()}>
            <PlanBadge operationId={operationId} />
        </QueryClientProvider>,
    );
}

describe("PlanBadge (Data API 10.0)", () => {
    it("pay as you go reaches a PRO operation: no badge; ENTERPRISE still badges", () => {
        badgeFor(ME_PAYG, "getTranscript");

        expect(screen.queryByText("PRO")).toBeNull();

        cleanup();

        badgeFor(ME_PAYG, "listDatasets");

        expect(screen.getByText("ENTERPRISE")).toBeInTheDocument();
    });

    it("a LITE operation shows the LITE badge on the FREE plan", () => {
        expect(tierLabel("listFilings")).toBe("LITE");

        badgeFor({ ...ME_PRO, plan: "free" }, "listFilings");

        expect(screen.getByText("LITE")).toBeInTheDocument();
    });
});
