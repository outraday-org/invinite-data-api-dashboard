import type { AlertConditionField } from "@/lib/api/types";

import type { AlertFormState, FieldText } from "./alert-form";
import type { ConditionFieldSpec } from "./condition-fields";

import { CONDITION_FIELDS } from "./condition-fields";
import { ALERT_TYPE_INFO, enumWords } from "./labels";

/** The summary's title ("SEC filing on AAPL, MSFT") and its detail phrases, shown joined by " · ". */
export type AlertFormSummary = { details: Array<string>; title: string };

const TARGET_FIELDS: ReadonlyArray<AlertConditionField> = ["symbols", "symbol", "ciks", "cik"];

/** How many targets the title names before "+N". */
const TARGETS_SHOWN = 3;

/** How many condition details the summary names before "and N more". */
const DETAILS_SHOWN = 3;

function entriesOf(spec: ConditionFieldSpec, value: FieldText | undefined): Array<string> {
    if (value === undefined) return [];

    if (Array.isArray(value)) return value.map(String).filter(Boolean);

    const text = value.trim();

    if (text === "") return [];

    if (spec.kind === "string-list" || spec.kind === "int-list") return text.split(spec.splitOnCommasOnly ? /[,\n]/ : /[\s,]+/).map(item => item.trim()).filter(Boolean);

    return [text];
}

function targetText(entries: ReadonlyArray<string>) {
    const shown = entries.slice(0, TARGETS_SHOWN).join(", ");

    return entries.length > TARGETS_SHOWN ? `${shown} +${entries.length - TARGETS_SHOWN}` : shown;
}

/** One condition field in words: "form types 8-K, 10-K"; a JSON field only says that it is set. */
function detailText(spec: ConditionFieldSpec, entries: ReadonlyArray<string>) {
    const label = spec.label.toLowerCase();

    if (spec.kind === "json" || spec.kind === "template") return `${label} set`;

    if (spec.kind === "boolean") return entries[0] === "true" ? label : `not ${label}`;

    const words = spec.kind === "enum" || spec.kind === "enum-list" ? entries.map(enumWords) : entries;

    return `${label} ${words.join(", ")}`;
}

/**
 * The alert form's summary in plain words (ui-redesign task 13; pure): what it watches — the type and its companies or
 * instrument — then the other condition fields that hold a value, the trigger mode and where it is delivered. Read from
 * the form STATE (the text the fields write), so it follows every keystroke; the request body below it is the exact
 * answer to "what will be sent".
 */
export function alertFormSummary(state: AlertFormState): AlertFormSummary {
    const condition = state.condition;

    const targets = CONDITION_FIELDS[state.type].filter(spec => TARGET_FIELDS.includes(spec.name)).flatMap(spec => entriesOf(spec, condition[spec.name]));

    const typeLabel = ALERT_TYPE_INFO[state.type].label;

    const title = targets.length > 0 ? `${typeLabel} on ${targetText(targets)}` : typeLabel;

    const conditionDetails = CONDITION_FIELDS[state.type]
        .filter(spec => !TARGET_FIELDS.includes(spec.name))
        .flatMap((spec) => {
            const entries = entriesOf(spec, condition[spec.name]);

            return entries.length > 0 ? [detailText(spec, entries)] : [];
        });

    if (state.type === "indicator" && state.indicatorMode === "template" && state.template.key) conditionDetails.unshift(`template ${state.template.key}`);

    const details = conditionDetails.length > DETAILS_SHOWN
        ? [...conditionDetails.slice(0, DETAILS_SHOWN), `and ${conditionDetails.length - DETAILS_SHOWN} more`]
        : conditionDetails;

    if (state.trigger.mode === "once") details.push("fires once");

    const destinations = state.destinationIds.split(/[\s,]+/).filter(Boolean).length;

    details.push(destinations === 0 ? "event feed and live stream only" : `delivered to ${destinations} destination${destinations === 1 ? "" : "s"}`);

    if (state.externalUserId.trim()) details.push(`for end user ${state.externalUserId.trim()}`);

    return { details, title };
}
