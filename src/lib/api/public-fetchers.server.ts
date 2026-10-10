import type { ApiStatusResponse, EarningsCallsStatusResponse, LicensingResponse } from "./types";

import { createPublicApiClient } from "./client.server";
import { throwApiError } from "./errors";
import { createMemo, PUBLIC_STATUS_TTL_MS } from "./public-memo";

/**
 * The plain fetchers behind the public `/status*` server functions (task 21). Key-less
 * (`createPublicApiClient`, never `createApiClient`) and memoised per input for 5 min: on Netlify
 * every visitor shares one IDA ingress client, so the memo keeps the pages under the status budget.
 */
const apiStatusMemo = createMemo<ApiStatusResponse>();

const earningsCallsStatusMemo = createMemo<EarningsCallsStatusResponse>();

const licensingMemo = createMemo<LicensingResponse>();

export function fetchApiStatus(days?: number): Promise<ApiStatusResponse> {
    return apiStatusMemo(`${days ?? ""}`, PUBLIC_STATUS_TTL_MS, async () => {
        const { data, error, response } = await createPublicApiClient().GET("/status", {
            params: { query: { days } },
        });

        if (error) throwApiError(error, response);

        return data;
    });
}

export type EarningsCallsStatusInput = {
    days?: number;
    vendor?: string;
};

export function fetchEarningsCallsStatus({ days, vendor }: EarningsCallsStatusInput): Promise<EarningsCallsStatusResponse> {
    return earningsCallsStatusMemo(`${days ?? ""}|${vendor ?? ""}`, PUBLIC_STATUS_TTL_MS, async () => {
        const { data, error, response } = await createPublicApiClient().GET("/status/earnings-calls", {
            params: { query: { days, vendor } },
        });

        if (error) throwApiError(error, response);

        return data;
    });
}

export function fetchLicensing(): Promise<LicensingResponse> {
    return licensingMemo("licensing", PUBLIC_STATUS_TTL_MS, async () => {
        const { data, error, response } = await createPublicApiClient().GET("/status/licensing");

        if (error) throwApiError(error, response);

        return data;
    });
}
