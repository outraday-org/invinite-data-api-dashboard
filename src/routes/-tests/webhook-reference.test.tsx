// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WebhookReferenceView } from "@/components/alerts/webhook-reference-view";
import { WEBHOOK_ENVELOPE, WEBHOOKS } from "@/lib/api/operations.gen";
import { Route } from "@/routes/alerts/webhooks";

import { webhookEntries } from "../../../scripts/webhooks.mjs";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
}));

afterEach(cleanup);

const spec = JSON.parse(readFileSync(resolve(__dirname, "../../../openapi.json"), "utf8")) as { "x-webhooks": Record<string, unknown> };

describe("/alerts/webhooks (x-webhooks of the pinned spec)", () => {
    it("lists all 7 payloads with when each is sent, its fields and an example labelled as built from the schema", () => {
        const Page = Route.options.component as React.ComponentType;

        render(<Page />);

        expect(screen.getByRole("heading", { name: "Webhooks" })).toBeInTheDocument();

        const entries = screen.getAllByTestId("webhook-entry");

        expect(entries.map(entry => within(entry).getByRole("heading").textContent)).toEqual(WEBHOOKS.map(entry => entry.type));

        expect(entries).toHaveLength(7);

        const test = entries.find(entry => within(entry).getByRole("heading").textContent === "destination.test")!;

        expect(within(test).getByText(WEBHOOKS.find(entry => entry.type === "destination.test")!.description, { selector: "p" })).toBeInTheDocument();

        expect(within(test).getByRole("table", { name: "destination.test data fields" })).toHaveTextContent("destination.id");

        expect(within(test).getByText("built from the schema: required fields")).toBeInTheDocument();
    });

    it("states the signature headers and the acknowledgement exactly as the spec does", () => {
        render(<WebhookReferenceView envelope={WEBHOOK_ENVELOPE} webhooks={WEBHOOKS} />);

        expect(screen.getByText(/Space-separated `v1,<base64 HMAC-SHA256 of id.timestamp.body>`, one per valid secret \(two during a rotation\)/)).toBeInTheDocument();

        expect(screen.getByText("2XX: Acknowledged; anything else is retried (410 disables)")).toBeInTheDocument();

        expect(screen.getByRole("table", { name: "Envelope fields" })).toHaveTextContent("timestamp");
    });

    it("a payload removed from the spec is removed from the page", () => {
        const { "destination.test": _dropped, ...rest } = spec["x-webhooks"];

        render(<WebhookReferenceView envelope={WEBHOOK_ENVELOPE} webhooks={webhookEntries({ ...spec, "x-webhooks": rest })} />);

        const types = screen.getAllByTestId("webhook-entry").map(entry => within(entry).getByRole("heading").textContent);

        expect(types).toHaveLength(6);

        expect(types).not.toContain("destination.test");

        expect(screen.queryByRole("link", { name: "destination.test" })).toBeNull();
    });
});
