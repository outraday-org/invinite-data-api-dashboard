import { useQuery } from "@tanstack/react-query";

import type { V2ServiceStatus } from "@/lib/api/types";

import { STATUS_PAGE_URL } from "@/lib/public-hosts";

export type OverallStatus = "unknown" | V2ServiceStatus;

function snapshotOverallStatus(snapshot: unknown): OverallStatus {
    if (!snapshot || typeof snapshot !== "object" || !("overall_status" in snapshot)) return "unknown";

    const status = snapshot.overall_status;

    return status === "operational" || status === "degraded" || status === "outage" ? status : "unknown";
}

/** The status site's keyless snapshot drives every overall indicator, including before sign-in. */
export function useOverallStatus(): OverallStatus {
    const { data, isError } = useQuery({
        queryFn: async ({ signal }) => {
            const response = await fetch(new URL("api/snapshot", STATUS_PAGE_URL), { credentials: "omit", signal });

            if (!response.ok) return "unknown" as const;

            return snapshotOverallStatus(await response.json());
        },
        queryKey: ["public-status-snapshot"],
        refetchInterval: 60_000,
        retry: false,
        staleTime: 30_000,
    });

    return isError ? "unknown" : data ?? "unknown";
}
