import { createFileRoute } from "@tanstack/react-router";

import { WebhookReferenceView } from "@/components/alerts/webhook-reference-view";
import { PageHeader } from "@/components/ui/page-header";
import { WEBHOOK_ENVELOPE, WEBHOOKS } from "@/lib/api/operations.gen";
import { titleHead } from "@/lib/layout";

export const Route = createFileRoute("/alerts/webhooks")({
    component: WebhooksPage,
    head: () => titleHead("Webhooks"),
});

/** The webhook payloads a destination receives, from the pinned spec's `x-webhooks` (no request: no credits). */
function WebhooksPage() {
    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                description={`The ${WEBHOOKS.length} payloads your destinations receive, as the pinned API spec defines them: when each is sent, its fields, the signature headers and how your answer is read.`}
                title="Webhooks"
            />
            <WebhookReferenceView envelope={WEBHOOK_ENVELOPE} webhooks={WEBHOOKS} />
        </div>
    );
}
