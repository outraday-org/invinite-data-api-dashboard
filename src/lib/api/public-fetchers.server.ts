import type { LicensingResponse } from "./types";

import { createPublicApiClient } from "./client.server";
import { throwApiError } from "./errors";
import { createMemo, PUBLIC_STATUS_TTL_MS } from "./public-memo";

/**
 * The plain fetcher behind the public `/licensing` server function (task 21). Key-less
 * (`createPublicApiClient`, never `createApiClient`) and memoised for 5 min: on Netlify every
 * visitor shares one IDA ingress client, so the memo keeps the page under the status budget.
 */
const licensingMemo = createMemo<LicensingResponse>();

export function fetchLicensing(): Promise<LicensingResponse> {
    return licensingMemo("licensing", PUBLIC_STATUS_TTL_MS, async () => {
        const { data, error, response } = await createPublicApiClient().GET("/status/licensing");

        if (error) throwApiError(error, response);

        return data;
    });
}
