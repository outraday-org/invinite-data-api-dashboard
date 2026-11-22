import type {
    Destination,
    DestinationCreated,
    DestinationDeliveriesResponse,
    DestinationDelivery,
    DestinationSecret,
    DestinationsListResponse,
    DestinationTestAccepted,
} from "@/lib/api/types";

import { FIXTURE_DESTINATION_ID } from "./alerts-fixtures";

/**
 * Destination fixtures (tests and the local mock API only; backend tasks/data-api-dashboard 2-alerts task 3). The spec
 * has no response examples for the destination operations: these follow the schemas (`Destination`,
 * `DestinationCreated`, `DestinationSecret`, `DestinationDelivery`, `DestinationTestAccepted`) with the spec's own example
 * id and the `createDestination` request example (`hooks.example.com/invinite-alerts`, "Production alert receiver").
 * The secrets are fake and only ever appear in the two write answers.
 */

/** A fake signing secret (never a real one). */
export const FIXTURE_SECRET = "whsec_FAKE0000fixture0000secret0000abcd";

export const FIXTURE_ROTATED_SECRET = "whsec_FAKE1111rotated1111secret1111wxyz";

export const DESTINATION_ACTIVE: Destination = {
    body_template: null,
    consecutive_failures: 0,
    created_at: "2026-11-20T14:00:00Z",
    description: "Production alert receiver",
    digest_seconds: null,
    disabled_reason: null,
    header_names: ["X-Receiver-Token"],
    id: FIXTURE_DESTINATION_ID,
    kind: "webhook",
    max_events_per_minute: 600,
    preset: "standard",
    previous_secret_expires_at: null,
    secret_hint: "abcd",
    status: "active",
    updated_at: "2026-11-20T14:00:00Z",
    url: "https://hooks.example.com/invinite-alerts",
};

export const DESTINATION_DISABLED: Destination = {
    ...DESTINATION_ACTIVE,
    consecutive_failures: 14,
    description: null,
    digest_seconds: 60,
    disabled_reason: "failing",
    header_names: [],
    id: "dst_01JD2Q4X7Y8Z9A0B1C2D3E4FAIL",
    kind: "batch_webhook",
    max_events_per_minute: 120,
    status: "disabled",
    url: "https://broken.example.com/hook",
};

export const DESTINATIONS_PAGE_FIXTURE: DestinationsListResponse = {
    data: [DESTINATION_ACTIVE, DESTINATION_DISABLED],
    has_more: false,
    meta: {},
    next_cursor: null,
};

export const DESTINATION_CREATED: DestinationCreated = { ...DESTINATION_ACTIVE, secret: FIXTURE_SECRET };

export const DESTINATION_SECRET: DestinationSecret = { previous_secret_expires_at: "2026-11-22T14:00:00Z", secret: FIXTURE_ROTATED_SECRET };

export const DESTINATION_TEST_ACCEPTED: DestinationTestAccepted = { delivery_id: "dlv_test01", event_id: "evt_test01" };

export function fixtureDelivery(id: string, patch: Partial<DestinationDelivery> = {}): DestinationDelivery {
    return {
        attempts: 1,
        batch_id: null,
        created_at: "2026-11-21T13:05:00Z",
        delivered_at: "2026-11-21T13:05:01Z",
        duration_ms: 182,
        event_id: `evt_${id}`,
        id: `dlv_${id}`,
        last_error: null,
        last_status: 200,
        next_attempt_at: null,
        status: "succeeded",
        ...patch,
    };
}

export const DELIVERY_OK = fixtureDelivery("ok");

export const DELIVERY_FAILED = fixtureDelivery("failed", {
    attempts: 3,
    delivered_at: null,
    duration_ms: 10_000,
    last_error: "timeout",
    last_status: null,
    next_attempt_at: "2026-11-21T14:05:00Z",
    status: "failed",
});

export const DELIVERY_DEAD = fixtureDelivery("dead", {
    attempts: 10,
    batch_id: "bat_01",
    delivered_at: null,
    last_error: "http_status",
    last_status: 500,
    status: "dead",
});

export const DELIVERIES_PAGE_FIXTURE: DestinationDeliveriesResponse = {
    data: [DELIVERY_OK, DELIVERY_FAILED, DELIVERY_DEAD],
    has_more: true,
    meta: {},
    next_cursor: "c2",
};
