// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WebhookReferenceView } from "@/components/alerts/webhook-reference-view";
import { ALERT_TYPE_FIELDS, WEBHOOK_ENVELOPE, WEBHOOKS } from "@/lib/api/operations.gen";
import { Route, webhookSearchSchema } from "@/routes/alerts/webhooks";

import { webhookEntries } from "../../../scripts/webhooks.mjs";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options, useNavigate: () => vi.fn(), useSearch: () => ({}) }),
    Link: ({ children, hash, search, to }: { children: React.ReactNode; hash?: string; search?: Record<string, string>; to: string }) => <a href={`${to}${search ? `?${new URLSearchParams(search)}` : ""}${hash ? `#${hash}` : ""}`}>{children}</a>,
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

describe("typed webhook reference", () => {
    it.each(Object.keys(ALERT_TYPE_FIELDS))("%s is reachable and shows its own fields and published example", (type) => {
        const { container } = render(<WebhookReferenceView envelope={WEBHOOK_ENVELOPE} selectedType={type} webhooks={WEBHOOKS} />);

        const fired = container.querySelector<HTMLElement>(`#webhook-alert\\.fired-${type}`)!;

        expect(fired).not.toBeNull();

        expect(within(fired).getByRole("table", { name: "alert.fired data fields" })).toHaveTextContent("alert_type");

        expect(within(fired).getByText("Published schema example")).toBeInTheDocument();

        expect(fired).toHaveTextContent(`"${type}"`);

        expect(within(screen.getByRole("navigation", { name: "Webhook types" })).getAllByRole("link").length).toBe(27);
    });

    it("unknown URL values select the first variant and retain all per-type anchors", () => {
        expect(webhookSearchSchema.parse({ type: "unknown" })).toEqual({ type: undefined });

        render(<WebhookReferenceView envelope={WEBHOOK_ENVELOPE} selectedType="unknown" webhooks={WEBHOOKS} />);

        expect(screen.getByRole("button", { name: "Alert type" })).toHaveTextContent("SEC filing (filing)");

        expect(screen.getByRole("link", { name: "Trading halt" })).toHaveAttribute("href", "/alerts/webhooks?type=halt#webhook-alert.fired-halt");
    });

    it("clearing or rejecting a controlled URL type restores the first variant", async () => {
        const onTypeChange = vi.fn();

        const view = render(<WebhookReferenceView envelope={WEBHOOK_ENVELOPE} onTypeChange={onTypeChange} selectedType="price" webhooks={WEBHOOKS} />);

        fireEvent.click(screen.getByRole("button", { name: "Alert type" }));

        fireEvent.click(await screen.findByRole("menuitemradio", { name: "Trading halt (halt)" }));

        expect(onTypeChange).toHaveBeenCalledWith("halt");

        view.rerender(<WebhookReferenceView envelope={WEBHOOK_ENVELOPE} onTypeChange={onTypeChange} selectedType="halt" webhooks={WEBHOOKS} />);

        expect(screen.getByRole("button", { name: "Alert type" })).toHaveTextContent("Trading halt (halt)");

        view.rerender(<WebhookReferenceView envelope={WEBHOOK_ENVELOPE} onTypeChange={onTypeChange} selectedType={undefined} webhooks={WEBHOOKS} />);

        expect(screen.getByRole("button", { name: "Alert type" })).toHaveTextContent("SEC filing (filing)");
    });

    it("the picker updates the selected example and copy carries exactly one webhook data envelope", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);

        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

        const onTypeChange = vi.fn();

        const view = render(<WebhookReferenceView envelope={WEBHOOK_ENVELOPE} onTypeChange={onTypeChange} webhooks={WEBHOOKS} />);

        fireEvent.click(screen.getByRole("button", { name: "Alert type" }));

        fireEvent.click(await screen.findByRole("menuitemradio", { name: "Trading halt (halt)" }));

        expect(onTypeChange).toHaveBeenCalledWith("halt");

        view.rerender(<WebhookReferenceView envelope={WEBHOOK_ENVELOPE} onTypeChange={onTypeChange} selectedType="halt" webhooks={WEBHOOKS} />);

        fireEvent.click(screen.getByRole("button", { name: "Copy the alert.fired example" }));

        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

        expect(JSON.parse(writeText.mock.calls[0][0])).toEqual({ data: ALERT_TYPE_FIELDS.halt.firedExample, timestamp: "2026-11-21T14:30:00Z", type: "alert.fired" });
    });
});
