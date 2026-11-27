import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { WebhookReferenceView } from "@/components/alerts/webhook-reference-view";
import { PageHeader } from "@/components/ui/page-header";
import { WEBHOOK_ENVELOPE, WEBHOOKS } from "@/lib/api/operations.gen";
import { titleHead } from "@/lib/layout";
import { IN_PLACE } from "@/lib/url-state";

export const WEBHOOK_ALERT_TYPES = WEBHOOKS.find(entry => entry.type === "alert.fired")?.data.variants?.map(variant => variant.value) ?? [];

export const webhookSearchSchema = z.object({ type: z.enum(WEBHOOK_ALERT_TYPES).optional().catch(undefined) });

export const Route = createFileRoute("/alerts/webhooks")({
    component: WebhooksPage,
    head: () => titleHead("Webhooks"),
    validateSearch: webhookSearchSchema,
});

/** The webhook payloads a destination receives, from the pinned spec's `x-webhooks` (no request: no credits). */
function WebhooksPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                description={`The ${WEBHOOKS.length} payloads your destinations receive, as the pinned API spec defines them: when each is sent, its fields, the signature headers and how your answer is read.`}
                title="Webhooks"
            />
            <WebhookReferenceView envelope={WEBHOOK_ENVELOPE} onTypeChange={type => void navigate({ ...IN_PLACE, hash: `webhook-alert.fired-${type}`, search: { type } })} selectedType={search.type} webhooks={WEBHOOKS} />
        </div>
    );
}
