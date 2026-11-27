import type { AlertConditionField, AlertTriggerField, AlertType, CreateAlertRequest, AlertFiredData, JsonValue } from "../src/lib/api/types";

export type AlertField<Name extends string = string> = {
    name: Name;
    kind: "boolean" | "datetime" | "enum" | "enum-list" | "int-list" | "integer" | "json" | "number" | "string" | "string-list";
    required: boolean;
    description: string;
    enum?: ReadonlyArray<string>;
    min?: number;
    max?: number;
    maxItems?: number;
    ref?: string;
};

export type AlertTypeFields = {
    condition: ReadonlyArray<AlertField>;
    trigger: ReadonlyArray<AlertField>;
    firedDetails: ReadonlyArray<AlertField>;
    example: JsonValue;
    firedExample: JsonValue;
    requestSchema: Record<string, unknown>;
};

export function alertTypeFields(spec: unknown): Record<string, AlertTypeFields>;

export type AlertTypeMetadata<T extends AlertType> = {
    condition: Array<AlertField<AlertConditionField>>;
    trigger: Array<AlertField<AlertTriggerField>>;
    firedDetails: Array<AlertField>;
    example: Extract<CreateAlertRequest, { type: T }>;
    firedExample: AlertFiredData<T>;
    requestSchema: import("zod").core.JSONSchema.JSONSchema;
};
