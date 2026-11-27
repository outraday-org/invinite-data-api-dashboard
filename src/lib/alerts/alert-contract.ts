import { z } from "zod";

import type { AlertType, CreateAlertRequest } from "@/lib/api/types";

import { ALERT_TYPE_FIELDS } from "@/lib/api/operations.gen";
import { isRecord } from "@/lib/guards";

const validators = new Map<AlertType, z.ZodType>();

const fieldValidators = new Map<string, z.ZodType>();

/** Compile only the selected variant; no remote schema fetch or prose-derived rules. */
export function createValidator(type: AlertType) {
    let validator = validators.get(type);

    if (!validator) {
        validator = z.fromJSONSchema(ALERT_TYPE_FIELDS[type].requestSchema);

        validators.set(type, validator);
    }

    return validator;
}

/** The runtime boundary between free editor text and SDK 13's correlated request union. */
export function isCreateAlertRequest(value: unknown): value is CreateAlertRequest {
    if (!isRecord(value) || typeof value.type !== "string" || !Object.hasOwn(ALERT_TYPE_FIELDS, value.type)) return false;

    return createValidator(value.type as AlertType).safeParse(value).success;
}

/** The selected field alone, for retaining shared editor values across a type switch. */
export function fieldValidator(type: AlertType, group: "condition" | "trigger", name: string) {
    const key = `${type}.${group}.${name}`;

    let validator = fieldValidators.get(key);

    if (!validator) {
        const properties = ALERT_TYPE_FIELDS[type].requestSchema.properties[group].properties;

        const schema = Object.entries(properties).find(([field]) => field === name)?.[1];

        if (!schema) return null;

        validator = z.fromJSONSchema(schema);

        fieldValidators.set(key, validator);
    }

    return validator;
}
