import * as React from "react";

import type { DestinationOptions, ScriptOptions } from "@/components/alerts/alert-form-pickers";
import type { AlertUserOption } from "@/components/alerts/alert-user-picker";
import type { MacroAccess } from "@/components/macro/macro-availability";
import type { ActiveWindowState, AlertFormState, FieldErrors, FieldText } from "@/lib/alerts/alert-form";
import type { ConditionFieldSpec, FieldSpec } from "@/lib/alerts/condition-fields";
import type { AlertTemplate, AlertType } from "@/lib/api/types";

import { declaredInputsOf, DestinationPicker, ScriptInputsFields, ScriptVersionPicker } from "@/components/alerts/alert-form-pickers";
import { AlertUserPicker } from "@/components/alerts/alert-user-picker";
import { MacroAvailabilityNotice } from "@/components/macro/macro-availability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVE_WINDOW_DAYS, ACTIVE_WINDOW_UNITS, CONDITION_FIELDS, INDICATOR_STRUCTURED_FIELDS, triggerFieldsFor, WEEKDAY_LABELS } from "@/lib/alerts/condition-fields";
import { ALERT_TYPE_GROUPS, ALERT_TYPE_INFO, enumWords } from "@/lib/alerts/labels";
import { cn } from "@/lib/utils";

import { MacroConditionFields } from "./macro-condition-fields";

/** The select's value for "not set" (a select item needs a non-empty value). */
const UNSET = "__unset";

const fieldId = (key: string) => `alert-field-${key.replaceAll(".", "-")}`;

const WIDE_KINDS = new Set<FieldSpec["kind"]>(["enum-list", "json", "string-list", "weekday-list"]);

/** One labelled field of the alerts forms: label, input, help, the field's error (A4's dialogs use it too). */
export function FieldShell({ children, error, help, htmlFor, label, wide }: { children: React.ReactNode; error?: string; help?: React.ReactNode; htmlFor?: string; label: string; wide?: boolean }) {
    return (
        <div className={cn("flex min-w-0 flex-col gap-1", wide && "sm:col-span-2")} data-field={htmlFor}>
            {htmlFor ? <label className="font-medium" htmlFor={htmlFor}>{label}</label> : <span className="font-medium">{label}</span>}
            {children}
            {help && <p className="text-muted-foreground">{help}</p>}
            {error && <p className="text-destructive" role="alert">{error}</p>}
        </div>
    );
}

function ChoiceSelect({ id, label, onChange, options, value }: { id: string; label: string; onChange: (value: string) => void; options: ReadonlyArray<{ label: string; value: string }>; value: string }) {
    const all = [{ label: "Not set", value: UNSET }, ...options];

    return (
        <Select onValueChange={next => onChange(next === UNSET || next === null ? "" : String(next))} value={value === "" ? UNSET : value}>
            <SelectTrigger aria-label={label} className="w-full" id={id}>
                {all.find(option => option.value === (value === "" ? UNSET : value))?.label ?? value}
            </SelectTrigger>
            <SelectContent>
                {all.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

function CheckboxGroup({ label, onChange, options, value }: { label: string; onChange: (value: Array<string>) => void; options: ReadonlyArray<{ label: string; value: string }>; value: ReadonlyArray<string> }) {
    return (
        <div aria-label={label} className="flex flex-wrap gap-x-3 gap-y-1" role="group">
            {options.map(option => (
                <label className="inline-flex items-center gap-1.5" key={option.value}>
                    <input
                        checked={value.includes(option.value)}
                        className="size-3.5 accent-primary"
                        onChange={event => onChange(event.target.checked ? [...value, option.value] : value.filter(item => item !== option.value))}
                        type="checkbox"
                    />
                    {option.label}
                </label>
            ))}
        </div>
    );
}

const optionList = (values: ReadonlyArray<string> | undefined) => (values ?? []).map(value => ({ label: enumWords(value), value }));

const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((label, index) => ({ label, value: String(index) }));

/** A numeric field's bounds as a hint: " (1–90)", " (at least 0)", " (at most 6)"; "" without bounds (pure). */
export function rangeText({ max, min }: Pick<FieldSpec, "max" | "min">) {
    if (min !== undefined && max !== undefined) return ` (${min}–${max})`;

    if (min !== undefined) return ` (at least ${min})`;

    return max === undefined ? "" : ` (at most ${max})`;
}

/** One field's editor by its kind (the field map's `FieldSpec`). */
export function FieldInput({ error, fieldKey, onChange, spec, value }: { error?: string; fieldKey: string; onChange: (value: FieldText) => void; spec: FieldSpec; value: FieldText | undefined }) {
    const id = fieldId(fieldKey);

    const text = typeof value === "string" ? value : "";

    const picked = Array.isArray(value) ? value : [];

    const numeric = spec.kind === "integer" || spec.kind === "number" || spec.kind === "int-list";

    const range = numeric ? rangeText(spec) : "";

    const grouped = spec.kind === "enum-list" || spec.kind === "weekday-list";

    let input: React.ReactNode;

    switch (spec.kind) {
        case "boolean": {
            input = <ChoiceSelect id={id} label={spec.label} onChange={onChange} options={[{ label: "Yes", value: "true" }, { label: "No", value: "false" }]} value={text} />;

            break;
        }

        case "datetime": {
            input = <Input id={id} onChange={event => onChange(event.target.value)} step={1} type="datetime-local" value={text} />;

            break;
        }

        case "enum": {
            input = <ChoiceSelect id={id} label={spec.label} onChange={onChange} options={optionList(spec.options)} value={text} />;

            break;
        }

        case "enum-list": {
            input = <CheckboxGroup label={spec.label} onChange={onChange} options={optionList(spec.options)} value={picked} />;

            break;
        }

        case "json": {
            input = <Textarea className="font-mono" id={id} onChange={event => onChange(event.target.value)} placeholder={spec.placeholder} rows={4} spellCheck={false} value={text} />;

            break;
        }

        case "string-list": {
            input = <Textarea id={id} onChange={event => onChange(event.target.value)} placeholder={spec.splitOnCommasOnly ? "One per line or comma" : "Separated by commas or spaces"} rows={2} value={text} />;

            break;
        }

        case "time-of-day": {
            input = <Input id={id} onChange={event => onChange(event.target.value)} type="time" value={text} />;

            break;
        }

        case "weekday": {
            input = <ChoiceSelect id={id} label={spec.label} onChange={onChange} options={WEEKDAY_OPTIONS} value={text} />;

            break;
        }

        case "weekday-list": {
            input = <CheckboxGroup label={spec.label} onChange={onChange} options={WEEKDAY_OPTIONS} value={picked} />;

            break;
        }

        default: {
            input = (
                <Input
                    id={id}
                    inputMode={numeric ? "decimal" : undefined}
                    onChange={event => onChange(event.target.value)}
                    placeholder={spec.kind === "int-list" ? "Comma list" : undefined}
                    value={text}
                />
            );
        }
    }

    return (
        <FieldShell error={error} help={`${spec.help}${range}`} htmlFor={grouped ? undefined : id} label={spec.label} wide={WIDE_KINDS.has(spec.kind)}>
            {input}
        </FieldShell>
    );
}

/** The indicator template picker: one of `listAlertTemplates`, its description and fidelity, a field per input. */
function TemplatePicker({ errors, onChange, state, templates }: { errors: FieldErrors; onChange: (template: AlertFormState["template"]) => void; state: AlertFormState["template"]; templates: TemplatesState }) {
    const template = templates.data.find(item => item.key === state.key);

    return (
        <div className="flex flex-col gap-3 sm:col-span-2">
            <FieldShell error={errors["condition.template"] ?? (templates.error ? "The templates could not be loaded; type the key." : undefined)} help="A built-in indicator template (GET /v1/alert-templates)." htmlFor={fieldId("condition.template")} label="Template">
                {templates.data.length > 0
                    ? (
                            <ChoiceSelect
                                id={fieldId("condition.template")}
                                label="Template"
                                onChange={key => onChange({ inputs: {}, key })}
                                options={templates.data.map(item => ({ label: `${item.title} (${item.key})`, value: item.key }))}
                                value={state.key}
                            />
                        )
                    : <Input disabled={templates.isLoading} id={fieldId("condition.template")} onChange={event => onChange({ ...state, key: event.target.value })} placeholder={templates.isLoading ? "Loading templates…" : "rsi-cross"} value={state.key} />}
            </FieldShell>
            {template && (
                <div className="flex flex-col gap-2 rounded-lg border p-3">
                    <p>
                        {template.description}
                        {" "}
                        <Badge title={template.fidelity === "exact" ? "Its state restores from a snapshot after a restart" : "It warms up from history again after a restart"} variant="outline">
                            {`Fidelity: ${template.fidelity}`}
                        </Badge>
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {template.inputs.map(input => (
                            <FieldInput
                                error={errors[`condition.template.inputs.${input.name}`]}
                                fieldKey={`condition.template.inputs.${input.name}`}
                                key={input.name}
                                onChange={value => onChange({ ...state, inputs: { ...state.inputs, [input.name]: typeof value === "string" ? value : value.join(",") } })}
                                spec={{
                                    help: `Default ${String(input.default)}.`,
                                    kind: input.kind === "bool" ? "boolean" : input.kind === "enum" ? "enum" : input.kind === "int" ? "integer" : "number",
                                    label: input.title,
                                    max: input.max,
                                    min: input.min,
                                    options: input.options,
                                }}
                                value={state.inputs[input.name] ?? ""}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ActiveWindowFields({ errors, onChange, window }: { errors: FieldErrors; onChange: (window: ActiveWindowState) => void; window: ActiveWindowState }) {
    const set = (patch: Partial<ActiveWindowState>) => onChange({ ...window, ...patch });

    return (
        <div className="flex flex-col gap-3 sm:col-span-2">
            <FieldShell help="Fires only inside this window: weekly (days + from / to in a time zone) or every (an anchor, an interval and a duration)." htmlFor={fieldId("trigger.active_window")} label="Active window">
                <ChoiceSelect
                    id={fieldId("trigger.active_window")}
                    label="Active window"
                    onChange={type => set({ type: type as ActiveWindowState["type"] })}
                    options={[{ label: "Weekly", value: "weekly" }, { label: "Every N units", value: "every" }]}
                    value={window.type}
                />
            </FieldShell>
            {window.type === "weekly" && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <FieldShell label="Days" wide>
                        <CheckboxGroup label="Window days" onChange={days => set({ days })} options={ACTIVE_WINDOW_DAYS.map(day => ({ label: day, value: day }))} value={window.days} />
                    </FieldShell>
                    <FieldShell help="HH:MM, 24 h." htmlFor={fieldId("trigger.active_window.from")} label="From">
                        <Input id={fieldId("trigger.active_window.from")} onChange={event => set({ from: event.target.value })} type="time" value={window.from} />
                    </FieldShell>
                    <FieldShell help="HH:MM, 24 h." htmlFor={fieldId("trigger.active_window.to")} label="To">
                        <Input id={fieldId("trigger.active_window.to")} onChange={event => set({ to: event.target.value })} type="time" value={window.to} />
                    </FieldShell>
                    <FieldShell help="IANA time zone, e.g. America/New_York." htmlFor={fieldId("trigger.active_window.timezone")} label="Time zone">
                        <Input id={fieldId("trigger.active_window.timezone")} onChange={event => set({ timezone: event.target.value })} value={window.timezone} />
                    </FieldShell>
                </div>
            )}
            {window.type === "every" && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <FieldShell error={errors["trigger.active_window.anchor_at"]} help="Start of the first window." htmlFor={fieldId("trigger.active_window.anchor_at")} label="Anchor">
                        <Input id={fieldId("trigger.active_window.anchor_at")} onChange={event => set({ anchorAt: event.target.value })} type="datetime-local" value={window.anchorAt} />
                    </FieldShell>
                    <FieldShell error={errors["trigger.active_window.interval"]} help="Windows repeat every N units." htmlFor={fieldId("trigger.active_window.interval")} label="Every">
                        <Input id={fieldId("trigger.active_window.interval")} inputMode="numeric" onChange={event => set({ interval: event.target.value })} value={window.interval} />
                    </FieldShell>
                    <FieldShell htmlFor={fieldId("trigger.active_window.unit")} label="Unit">
                        <ChoiceSelect id={fieldId("trigger.active_window.unit")} label="Unit" onChange={unit => set({ unit })} options={optionList(ACTIVE_WINDOW_UNITS)} value={window.unit} />
                    </FieldShell>
                    <FieldShell error={errors["trigger.active_window.active_duration_seconds"]} help="Window length, at least 60 s." htmlFor={fieldId("trigger.active_window.active_duration_seconds")} label="Duration (seconds)">
                        <Input id={fieldId("trigger.active_window.active_duration_seconds")} inputMode="numeric" onChange={event => set({ activeDurationSeconds: event.target.value })} value={window.activeDurationSeconds} />
                    </FieldShell>
                </div>
            )}
            {errors["trigger.active_window"] && <p className="text-destructive" role="alert">{errors["trigger.active_window"]}</p>}
        </div>
    );
}

function TypePicker({ disabled, macroAvailable, onChange, type }: { macroAvailable: boolean; disabled: boolean; onChange: (type: AlertType) => void; type: AlertType }) {
    return (
        <FieldShell help={ALERT_TYPE_INFO[type].summary} htmlFor={fieldId("type")} label="Type">
            <Select disabled={disabled} onValueChange={next => next && onChange(next)} value={type}>
                <SelectTrigger aria-label="Alert type" className="w-full sm:w-80" id={fieldId("type")}>{ALERT_TYPE_INFO[type].label}</SelectTrigger>
                <SelectContent>
                    {ALERT_TYPE_GROUPS.filter(group => macroAvailable || !group.types.includes("macro")).map(group => (
                        <SelectGroup key={group.label}>
                            <SelectLabel>{group.label}</SelectLabel>
                            {group.types.map(item => <SelectItem key={item} value={item}>{ALERT_TYPE_INFO[item].label}</SelectItem>)}
                        </SelectGroup>
                    ))}
                </SelectContent>
            </Select>
        </FieldShell>
    );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <fieldset className="flex flex-col gap-3 rounded-xl border p-4">
            <legend className="px-1 text-sm font-semibold">{title}</legend>
            {children}
        </fieldset>
    );
}

export type TemplatesState = { data: ReadonlyArray<AlertTemplate>; error: unknown; isLoading: boolean };

/**
 * The alert form (pure; `/alerts/new` and `/alerts/$id?edit=true`): 1 Type (18, in 8 groups; fixed on edit), 2 Condition
 * (the type's fields from `CONDITION_FIELDS`; the indicator's template or structured condition), 3 Trigger, 4 Delivery
 * (destination ids, end user — an existing one suggested —, reference, metadata). Field errors sit under their field; `notice` above the buttons
 * (a conflict, a quota, the Check result). "Check" = `validate_only` (nothing created).
 */
export function AlertFormView({
    destinationOptions,
    endUserOptions = [],
    errors,
    macroAccess = "available",
    mode,
    notice,
    onCancel,
    onChange,
    onCheck,
    onSubmit,
    pending,
    scriptOptions,
    state,
    templates,
}: {
    /** The destination picker's data (A4); absent = the id text field. */
    destinationOptions?: DestinationOptions;
    macroAccess?: MacroAccess;
    /** Existing end users suggested for the end-user field (A4: `useAlertUserOptions`). */
    endUserOptions?: ReadonlyArray<AlertUserOption>;
    errors: FieldErrors;
    mode: "create" | "edit";
    notice?: React.ReactNode;
    onCancel?: () => void;
    onChange: (state: AlertFormState) => void;
    onCheck?: () => void;
    onSubmit: () => void;
    pending: { check: boolean; submit: boolean };
    /** The script version picker's data (A4, `script` alerts); absent = the id text field. */
    scriptOptions?: ScriptOptions;
    state: AlertFormState;
    templates: TemplatesState;
}) {
    const set = (patch: Partial<AlertFormState>) => onChange({ ...state, ...patch });

    const fields: ReadonlyArray<ConditionFieldSpec> = CONDITION_FIELDS[state.type].filter((spec) => {
        if (state.type !== "indicator") return true;

        return state.indicatorMode === "template" ? !INDICATOR_STRUCTURED_FIELDS.includes(spec.name) : spec.name !== "template";
    });

    if (state.type === "macro" && macroAccess !== "available") return <MacroAvailabilityNotice access={macroAccess} />;

    const busy = pending.check || pending.submit;

    return (
        <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();

                if (!busy) onSubmit();
            }}
        >
            <Section title="1. Type">
                <TypePicker disabled={mode === "edit"} macroAvailable={macroAccess === "available"} onChange={type => set({ type, ...(type === "macro" && !state.condition.macro_events ? { condition: { ...state.condition, macro_events: ["macro.released", "macro.revised"] } } : {}) })} type={state.type} />
                {mode === "edit" && <p className="text-muted-foreground">The type of an alert never changes; duplicate it to start from another type.</p>}
            </Section>
            <Section title="2. Condition">
                {state.type === "indicator" && (
                    <div aria-label="Indicator condition" className="flex gap-2" role="radiogroup">
                        {(["template", "structured"] as const).map(indicatorMode => (
                            <Button aria-checked={state.indicatorMode === indicatorMode} key={indicatorMode} onClick={() => set({ indicatorMode })} role="radio" size="sm" type="button" variant={state.indicatorMode === indicatorMode ? "default" : "outline"}>
                                {indicatorMode === "template" ? "Built-in template" : "Structured condition"}
                            </Button>
                        ))}
                    </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                    {state.type === "macro" && <MacroConditionFields condition={state.condition} errors={errors} onChange={condition => set({ condition })} />}
                    {state.type !== "macro" && fields.map((spec) => {
                        if (spec.kind === "template") return <TemplatePicker errors={errors} key={spec.name} onChange={template => set({ template })} state={state.template} templates={templates} />;

                        const text = typeof state.condition[spec.name] === "string" ? state.condition[spec.name] as string : "";

                        const setText = (value: string) => set({ condition: { ...state.condition, [spec.name]: value } });

                        // A4: the script version from the account's scripts, its declared inputs as fields.
                        if (spec.name === "script_version_id" && scriptOptions) {
                            return (
                                <FieldShell error={errors["condition.script_version_id"]} help="A compiled version of one of your scripts (Scripts tab)." htmlFor={fieldId("condition.script_version_id")} key={spec.name} label="Script version" wide>
                                    <ScriptVersionPicker id={fieldId("condition.script_version_id")} onChange={setText} options={scriptOptions} value={text} />
                                </FieldShell>
                            );
                        }

                        const declared = spec.name === "inputs" ? declaredInputsOf(scriptOptions, typeof state.condition.script_version_id === "string" ? state.condition.script_version_id : "") : [];

                        if (declared.length > 0) {
                            return (
                                <FieldShell error={errors["condition.inputs"]} help="The inputs the version declares; an empty field keeps its default." key={spec.name} label="Script inputs" wide>
                                    <ScriptInputsFields inputs={declared} onChange={setText} text={text} />
                                </FieldShell>
                            );
                        }

                        return (
                            <FieldInput
                                error={errors[`condition.${spec.name}`]}
                                fieldKey={`condition.${spec.name}`}
                                key={spec.name}
                                onChange={value => set({ condition: { ...state.condition, [spec.name]: value } })}
                                spec={spec}
                                value={state.condition[spec.name]}
                            />
                        );
                    })}
                </div>
                {errors.condition && <p className="text-destructive" role="alert">{errors.condition}</p>}
            </Section>
            <Section title="3. Trigger">
                <div className="grid gap-3 sm:grid-cols-2">
                    {triggerFieldsFor(state.type).map(spec => (
                        <FieldInput
                            error={errors[`trigger.${spec.name}`]}
                            fieldKey={`trigger.${spec.name}`}
                            key={spec.name}
                            onChange={value => set({ trigger: { ...state.trigger, [spec.name]: typeof value === "string" ? value : value.join(",") } })}
                            spec={spec}
                            value={state.trigger[spec.name]}
                        />
                    ))}
                    <ActiveWindowFields errors={errors} onChange={window => set({ window })} window={state.window} />
                </div>
                {errors.trigger && <p className="text-destructive" role="alert">{errors.trigger}</p>}
            </Section>
            <Section title="4. Delivery">
                <div className="grid gap-3 sm:grid-cols-2">
                    {destinationOptions
                        ? (
                                <FieldShell error={errors.destination_ids} help="Where each fire is delivered (at most 10). None = the event feed and the live stream only." label="Destinations" wide>
                                    <DestinationPicker onChange={destinationIds => set({ destinationIds })} options={destinationOptions} value={state.destinationIds} />
                                </FieldShell>
                            )
                        : (
                                <FieldShell error={errors.destination_ids} help="Destination ids (dst_…, at most 10), one per line or comma. None = the event feed and the live stream only." htmlFor={fieldId("destination_ids")} label="Destinations" wide>
                                    <Textarea className="font-mono" id={fieldId("destination_ids")} onChange={event => set({ destinationIds: event.target.value })} rows={2} value={state.destinationIds} />
                                </FieldShell>
                            )}
                    <FieldShell error={errors.external_user_id} help="Your end user's id (filters lists and events): pick an existing one or type a new id (the alert creates it)." htmlFor={fieldId("external_user_id")} label="End user id">
                        <AlertUserPicker id={fieldId("external_user_id")} onChange={externalUserId => set({ externalUserId })} options={endUserOptions} value={state.externalUserId} />
                    </FieldShell>
                    <FieldShell error={errors.client_reference_id} help="Your id of the alert, unique per account (a second create with it returns the live alert)." htmlFor={fieldId("client_reference_id")} label="Client reference id">
                        <Input id={fieldId("client_reference_id")} onChange={event => set({ clientReferenceId: event.target.value })} value={state.clientReferenceId} />
                    </FieldShell>
                    <MetadataFields error={errors.metadata} onChange={metadata => set({ metadata })} rows={state.metadata} />
                </div>
            </Section>
            {errors.form && <p className="text-destructive" role="alert">{errors.form}</p>}
            {notice}
            <div className="flex flex-wrap gap-2">
                <Button disabled={busy} type="submit">{pending.submit ? "Saving…" : mode === "create" ? "Create alert" : "Save changes"}</Button>
                {onCheck && <Button disabled={busy} onClick={onCheck} type="button" variant="outline">{pending.check ? "Checking…" : "Check"}</Button>}
                {onCancel && <Button disabled={busy} onClick={onCancel} type="button" variant="ghost">Cancel</Button>}
            </div>
        </form>
    );
}

function MetadataFields({ error, onChange, rows }: { error?: string; onChange: (rows: AlertFormState["metadata"]) => void; rows: AlertFormState["metadata"] }) {
    return (
        <FieldShell error={error} help="Your own key / value pairs (≤ 50 keys, ≤ 8 KB), echoed in every event." label="Metadata" wide>
            <div className="flex flex-col gap-2">
                {rows.map((row, index) => (
                    // Rows have no id of their own; the position is the identity while the list is edited.

                    <div className="flex gap-2" key={index}>
                        <Input aria-label={`Metadata key ${index + 1}`} className="w-40" onChange={event => onChange(rows.map((item, at) => (at === index ? { ...item, key: event.target.value } : item)))} placeholder="key" value={row.key} />
                        <Input aria-label={`Metadata value ${index + 1}`} onChange={event => onChange(rows.map((item, at) => (at === index ? { ...item, value: event.target.value } : item)))} placeholder="value" value={row.value} />
                        <Button aria-label={`Remove metadata ${index + 1}`} onClick={() => onChange(rows.filter((_, at) => at !== index))} size="sm" type="button" variant="ghost">Remove</Button>
                    </div>
                ))}
                <Button className="self-start" onClick={() => onChange([...rows, { key: "", value: "" }])} size="sm" type="button" variant="outline">Add a key</Button>
            </div>
        </FieldShell>
    );
}
