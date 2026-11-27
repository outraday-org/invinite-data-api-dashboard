// Types of `webhooks.mjs` (the dashboard imports its result through `operations.gen.ts`; tests import it directly).

/** A schema as the reference page reads it: object properties as `fields` in the spec's order. */
export type WebhookSchema = {
    /** A free object (`additionalProperties`). */
    additionalProperties?: boolean;
    discriminator?: { propertyName: string; mapping?: Readonly<Record<string, string>> };
    variants?: ReadonlyArray<{ value: string; schema: WebhookSchema }>;
    example?: import("../src/lib/api/types").JsonValue;
    description?: string;
    enum?: ReadonlyArray<boolean | null | number | string>;
    fields?: ReadonlyArray<WebhookField>;
    format?: string;
    items?: WebhookSchema;
    maximum?: number;
    maxItems?: number;
    minimum?: number;
    minItems?: number;
    nullable?: boolean;
    type?: string;
};

export type WebhookField = { name: string; required: boolean; schema: WebhookSchema };

export type WebhookHeader = { description: string; name: string; required: boolean };

export type WebhookEntry = {
    /** The spec's responses, `"<status>: <description>"` ("2XX: Acknowledged; anything else is retried (410 disables)"). */
    acknowledgement: ReadonlyArray<string>;
    /** The type's `data` schema. */
    data: WebhookSchema;
    description: string;
    headers: ReadonlyArray<WebhookHeader>;
    summary: string;
    type: string;
};

export function simplifySchema(spec: unknown, schema: unknown): WebhookSchema;

export function webhookEntries(spec: unknown): Array<WebhookEntry>;

export function webhookEnvelope(spec: unknown): WebhookSchema;
