import type { ReactNode } from "react";

// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { STATUS_PAGE_URL } from "@/lib/public-hosts";
import { useOverallStatus } from "@/lib/reference/public-status";

afterEach(() => {
    cleanup();

    vi.unstubAllGlobals();
});

it("reads the keyless snapshot, honours its aggregate even with a passing probe, and clears stale colours", async () => {
    const fetchSnapshot = vi.fn()
        .mockResolvedValueOnce(Response.json({ overall_status: "degraded", probe: { recent: [{ ok: true }] } }))
        .mockResolvedValueOnce(Response.json({ overall_status: "operational" }))
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(Response.json({ overall_status: "outage" }))
        .mockResolvedValueOnce(Response.json({ probe: { recent: [{ ok: true }] } }));

    vi.stubGlobal("fetch", fetchSnapshot);

    const client = new QueryClient();

    const { result } = renderHook(useOverallStatus, {
        wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });

    expect(result.current).toBe("unknown");

    await waitFor(() => expect(result.current).toBe("degraded"));

    expect(fetchSnapshot).toHaveBeenCalledWith(new URL("api/snapshot", STATUS_PAGE_URL), expect.objectContaining({ credentials: "omit" }));

    for (const expected of ["operational", "unknown", "outage", "unknown"]) {
        await act(() => client.refetchQueries());

        await waitFor(() => expect(result.current).toBe(expected));
    }
});
