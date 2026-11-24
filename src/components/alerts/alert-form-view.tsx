import { ChevronDownIcon, ChevronRightIcon, InfoIcon } from "lucide-react";
import * as React from "react";

import type { DestinationOptions, ScriptOptions } from "@/components/alerts/alert-form-pickers";
import type { AlertUserOption } from "@/components/alerts/alert-user-picker";
import type { MacroAccess } from "@/components/macro/macro-availability";
import type { ActiveWindowState, AlertFormState, FieldErrors, FieldText } from "@/lib/alerts/alert-form";
import type { ConditionFieldSpec, FieldSpec, TriggerScalarField } from "@/lib/alerts/condition-fields";
import type { AlertConditionField, AlertTemplate, AlertType, JsonValue } from "@/lib/api/types";

import { declaredInputsOf, DestinationPicker, ScriptInputsFields, ScriptVersionPicker } from "@/components/alerts/alert-form-pickers";
import { AlertUserPicker } from "@/components/alerts/alert-user-picker";
import { JsonTree } from "@/components/api/json-tree";
import { MacroAvailabilityNotice } from "@/components/macro/macro-availability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TokenInput } from "@/components/ui/token-input";
import { alertFormSummary } from "@/lib/alerts/alert-form-summary";
import { ACTIVE_WINDOW_DAYS, ACTIVE_WINDOW_UNITS, CONDITION_FIELDS, INDICATOR_STRUCTURED_FIELDS, triggerFieldsFor, WEEKDAY_LABELS } from "@/lib/alerts/condition-fields";
import { ALERT_TYPE_GROUPS, ALERT_TYPE_INFO, enumWords } from "@/lib/alerts/labels";
import { redactSecrets } from "@/lib/api/request-meta";
import { cn } from "@/lib/utils";

import { MacroConditionFields } from "./macro-condition-fields";

/** The select's value for "not set" (a select item needs a non-empty value). */
const UNSET = "__unset";

const fieldId = (key: string) => `alert-field-${key.replaceAll(".", "-")}`;

/** Kinds that take the full row of the form's 2-column grid (a checkbox group, a JSON block). */
const WIDE_KINDS = new Set<FieldSpec["kind"]>(["enum-list", "json", "weekday-list"]);

/**
 * One labelled field of the alerts forms (A4's dialogs use it too; ui-redesign task 13): a 14 px label, the control, a
 * 12 px muted help line and the field's error. `helpMode="focus"` (the alert form's fields whose help carries no bound
 * or format) shows the help while the field has focus, on its (i) button, or with an error — otherwise it stays in the
 * DOM as screen-reader text, linked to the control by `aria-describedby` (`${htmlFor}-help`). `wide` = the whole row
 * of the field grid (`col-span-full`, never an implicit column).
 */
export function FieldShell({
    children,
    error,
    help,
    helpMode = "always",
    htmlFor,
    label,
    wide,
}: {
    children: React.ReactNode;
    error?: string;
    help?: React.ReactNode;
    helpMode?: "always" | "focus";
    htmlFor?: string;
    label: string;
    wide?: boolean;
}) {
    const [helpOpen, setHelpOpen] = React.useState(false);

    const generatedId = React.useId();

    const helpId = `${htmlFor ?? generatedId}-help`;

    const tucked = helpMode === "focus" && Boolean(help);

    return (
        <div className={cn("group/field flex min-w-0 flex-col gap-1", wide && "col-span-full")} data-field={htmlFor}>
            <div className="flex min-h-5 items-center gap-1">
                {htmlFor ? <label className="text-sm font-medium" htmlFor={htmlFor}>{label}</label> : <span className="text-sm font-medium">{label}</span>}
                {tucked && (
                    <button
                        aria-controls={helpId}
                        aria-expanded={helpOpen}
                        aria-label={`About ${label}`}
                        className="text-muted-foreground hover:text-foreground inline-flex size-5 items-center justify-center rounded-sm max-sm:size-7"
                        onClick={() => setHelpOpen(open => !open)}
                        type="button"
                    >
                        <InfoIcon className="size-3.5" />
                    </button>
                )}
            </div>
            {children}
            {help && (
                <p className={cn("text-muted-foreground text-xs", tucked && !helpOpen && !error && "sr-only group-focus-within/field:not-sr-only")} id={helpId}>
                    {help}
                </p>
            )}
            {error && <p className="text-destructive text-xs" role="alert">{error}</p>}
        </div>
    );
}

function ChoiceSelect({ id, label, onChange, options, value }: { id: string; label: string; onChange: (value: string) => void; options: ReadonlyArray<{ label: string; value: string }>; value: string }) {
    const all = [{ label: "Not set", value: UNSET }, ...options];

    return (
        <DropdownSelect
            aria-label={label}
            className="w-full"
            id={id}
            label={all.some(option => option.value === (value === "" ? UNSET : value)) ? undefined : value}
            onValueChange={next => onChange(next === UNSET ? "" : next)}
            options={all}
            value={value === "" ? UNSET : value}
        />
    );
}

function CheckboxGroup({ label, onChange, options, value }: { label: string; onChange: (value: Array<string>) => void; options: ReadonlyArray<{ label: string; value: string }>; value: ReadonlyArray<string> }) {
    return (
        <div aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1.5" role="group">
            {options.map(option => (
                <label className="inline-flex items-center gap-1.5 max-sm:min-h-9" key={option.value}>
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

/**
 * Whether a field's help must stay visible (pure): it carries a bound or a required format — a numeric range, a number
 * in the text ("1–10 digits", "at most 366 days", "HH:MM"), a list's cap, or a JSON / date / time field's shape.
 */
function helpIsPinned(spec: Pick<FieldSpec, "help" | "kind" | "max" | "maxItems" | "min">) {
    if (rangeText(spec) !== "" || spec.maxItems !== undefined || /\d/.test(spec.help)) return true;

    return spec.kind === "json" || spec.kind === "datetime" || spec.kind === "time-of-day" || spec.kind === "int-list";
}

/** One field's editor by its kind (the field map's `FieldSpec`). */
export function FieldInput({ error, fieldKey, onChange, spec, value }: { error?: string; fieldKey: string; onChange: (value: FieldText) => void; spec: FieldSpec; value: FieldText | undefined }) {
    const id = fieldId(fieldKey);

    const helpId = `${id}-help`;

    const text = typeof value === "string" ? value : "";

    const picked = Array.isArray(value) ? value : [];

    const numeric = spec.kind === "integer" || spec.kind === "number" || spec.kind === "int-list";

    const range = numeric ? rangeText(spec) : "";

    const grouped = spec.kind === "enum-list" || spec.kind === "weekday-list";

    const invalid = error ? true : undefined;

    let input: React.ReactNode;

    switch (spec.kind) {
        case "boolean": {
            input = <ChoiceSelect id={id} label={spec.label} onChange={onChange} options={[{ label: "Yes", value: "true" }, { label: "No", value: "false" }]} value={text} />;

            break;
        }

        case "datetime": {
            input = <Input aria-describedby={helpId} aria-invalid={invalid} id={id} onChange={event => onChange(event.target.value)} step={1} type="datetime-local" value={text} />;

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
            input = <Textarea aria-describedby={helpId} aria-invalid={invalid} className="font-mono" id={id} onChange={event => onChange(event.target.value)} placeholder={spec.placeholder} rows={3} spellCheck={false} value={text} />;

            break;
        }

        case "string-list": {
            // The chips read and write the very text the model splits (`alert-form.ts` unchanged): a new line between
            // keywords (they may hold spaces), ", " elsewhere — as `fieldText` writes a stored list.
            input = (
                <TokenInput
                    aria-describedby={helpId}
                    aria-invalid={invalid}
                    id={id}
                    joiner={spec.splitOnCommasOnly ? "\n" : ", "}
                    onChange={onChange}
                    placeholder={spec.splitOnCommasOnly ? "Type, then comma or Enter" : "Type, then space, comma or Enter"}
                    separators={spec.splitOnCommasOnly ? "commas" : "commas-and-spaces"}
                    value={text}
                />
            );

            break;
        }

        case "time-of-day": {
            input = <Input aria-describedby={helpId} aria-invalid={invalid} id={id} onChange={event => onChange(event.target.value)} type="time" value={text} />;

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
                    aria-describedby={helpId}
                    aria-invalid={invalid}
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
        <FieldShell
            error={error}
            help={`${spec.help}${range}`}
            helpMode={helpIsPinned(spec) ? "always" : "focus"}
            htmlFor={grouped ? undefined : id}
            label={spec.label}
            wide={WIDE_KINDS.has(spec.kind)}
        >
            {input}
        </FieldShell>
    );
}

/** The indicator template picker: one of `listAlertTemplates`, its description and fidelity, a field per input. */
function TemplatePicker({ errors, onChange, state, templates }: { errors: FieldErrors; onChange: (template: AlertFormState["template"]) => void; state: AlertFormState["template"]; templates: TemplatesState }) {
    const template = templates.data.find(item => item.key === state.key);

    return (
        <div className="col-span-full flex flex-col gap-3">
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
                <div className="flex flex-col gap-3 rounded-lg border p-3">
                    <p className="text-sm">
                        {template.description}
                        {" "}
                        <Badge title={template.fidelity === "exact" ? "Its state restores from a snapshot after a restart" : "It warms up from history again after a restart"} variant="outline">
                            {`Fidelity: ${template.fidelity}`}
                        </Badge>
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
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
        <div className="col-span-full flex flex-col gap-4">
            <FieldShell help="Fires only inside this window: weekly (days + from / to in a time zone) or every (an anchor, an interval and a duration)." helpMode="focus" htmlFor={fieldId("trigger.active_window")} label="Active window">
                <ChoiceSelect
                    id={fieldId("trigger.active_window")}
                    label="Active window"
                    onChange={type => set({ type: type as ActiveWindowState["type"] })}
                    options={[{ label: "Weekly", value: "weekly" }, { label: "Every N units", value: "every" }]}
                    value={window.type}
                />
            </FieldShell>
            {window.type === "weekly" && (
                <div className="grid gap-4 md:grid-cols-2">
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
                <div className="grid gap-4 md:grid-cols-2">
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
            {errors["trigger.active_window"] && <p className="text-destructive text-xs" role="alert">{errors["trigger.active_window"]}</p>}
        </div>
    );
}

function TypePicker({ disabled, macroAvailable, onChange, type }: { macroAvailable: boolean; disabled: boolean; onChange: (type: AlertType) => void; type: AlertType }) {
    return (
        <FieldShell help={ALERT_TYPE_INFO[type].summary} htmlFor={fieldId("type")} label="Type">
            <DropdownSelect
                aria-label="Alert type"
                className="w-full sm:w-80"
                disabled={disabled}
                groups={ALERT_TYPE_GROUPS.filter(group => macroAvailable || !group.types.includes("macro")).map(group => ({
                    label: group.label,
                    options: group.types.map(item => ({ label: ALERT_TYPE_INFO[item].label, value: item })),
                }))}
                id={fieldId("type")}
                label={ALERT_TYPE_INFO[type].label}
                onValueChange={onChange}
                value={type}
            />
        </FieldShell>
    );
}

/**
 * One part of the form, named by what it does (never numbered: the type can change last). From `md` the title sits in
 * a left column beside its fields; the fields are a 2-column grid from `md`.
 */
function FormSection({ children, title }: { children: React.ReactNode; title: string }) {
    const id = React.useId();

    return (
        <section aria-labelledby={id} className="grid gap-3 border-t pt-4 first:border-t-0 first:pt-0 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-x-6" data-slot="form-section">
            <h3 className="text-section md:pt-0.5" id={id}>{title}</h3>
            <div className="flex min-w-0 flex-col gap-4">{children}</div>
        </section>
    );
}

/** The 2-column field grid of a form section (one column below `md`). */
const FIELD_GRID_CLASS = "grid gap-4 md:grid-cols-2";

/**
 * A "More …" disclosure of rarely used fields: its fields stay mounted (`hidden`), so their labels, errors and the 400
 * mapping (`data-field`) work while it is closed; it opens by itself while a field in it has a value (when the form
 * opens) or an error (`forceOpen`).
 */
function Disclosure({ children, forceOpen, initialOpen, label }: { children: React.ReactNode; forceOpen: boolean; initialOpen: boolean; label: string }) {
    const [open, setOpen] = React.useState(initialOpen);

    const regionId = React.useId();

    const shown = open || forceOpen;

    return (
        <div className="flex flex-col gap-3" data-slot="form-disclosure">
            <Button aria-controls={regionId} aria-expanded={shown} className="-ml-2 h-auto min-h-7 max-w-full self-start py-1 text-left whitespace-normal" onClick={() => setOpen(!shown)} size="sm" type="button" variant="ghost">
                {shown ? <ChevronDownIcon /> : <ChevronRightIcon />}
                {label}
            </Button>
            <div className={FIELD_GRID_CLASS} hidden={!shown} id={regionId}>
                {children}
            </div>
        </div>
    );
}

/**
 * The condition fields kept in "More conditions": rarely used narrowing (a second company key, categories, amendments,
 * stage, baselines, script chains, …). The type's main fields stay in view. A set of the view, not of the field map:
 * `condition-fields.ts` describes the API, this the form's layout.
 */
const MORE_CONDITION_FIELDS: ReadonlySet<AlertConditionField> = new Set<AlertConditionField>([
    "alert_ids",
    "amount_change",
    "asset_class",
    "baseline",
    "baseline_mode",
    "cik",
    "ciks",
    "dividend_types",
    "earnings_only",
    "evaluation",
    "filters",
    "form_categories",
    "include_amendments",
    "lookback_bars",
    "mention_delta_rule",
    "min_mentions",
    "minutes_before",
    "nodes",
    "notify_on_date_change",
    "offsets_days",
    "price_direction",
    "reason_codes",
    "series_inputs",
    "sources",
    "speaker_roles",
    "stage",
    "window_minutes",
    "yield_rule",
    "yoy_rules",
]);

/** The trigger fields kept in "More trigger options" (with the active window); mode, cooldowns and re-arm stay in view. */
const MORE_TRIGGER_FIELDS: ReadonlySet<TriggerScalarField> = new Set<TriggerScalarField>(["activate_at", "delete_on_expiry", "expires_at", "max_fires", "pause_until"]);

const hasText = (value: FieldText | undefined) => (Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim() !== "");

/** Whether `errors` names a field under one of `prefixes` (`condition.ciks`, `trigger.active_window.anchor_at`). */
const errorUnder = (errors: FieldErrors, prefixes: ReadonlyArray<string>) => Object.keys(errors).some(key => prefixes.some(prefix => key === prefix || key.startsWith(`${prefix}.`)));

export type TemplatesState = { data: ReadonlyArray<AlertTemplate>; error: unknown; isLoading: boolean };

/** The request the form will send, shown in the summary (the editor computes it: `toCreateBody` / `toUpdateBody`). */
export type AlertRequestPreview = { body: unknown; method: "PATCH" | "POST"; path: string };

/** The summary (pure): the form in words and the request body it sends, secrets redacted as the inspector does. */
function AlertFormSummaryPanel({ preview, state }: { preview?: AlertRequestPreview; state: AlertFormState }) {
    const summary = alertFormSummary(state);

    const body = preview ? redactSecrets(JSON.parse(JSON.stringify(preview.body ?? null)) as JsonValue) : null;

    return (
        <div className="flex min-w-0 flex-col gap-3" data-testid="alert-form-summary">
            <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium" data-testid="alert-form-sentence">{summary.title}</p>
                <p className="text-muted-foreground">{summary.details.join(" · ")}</p>
            </div>
            {preview && (
                <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="text-muted-foreground text-xs">
                        {"Request body · "}
                        <span className="font-mono">{`${preview.method} ${preview.path}`}</span>
                    </p>
                    <JsonTree className="bg-muted/30 max-h-[50vh] overflow-auto rounded-md border p-2" value={body} />
                </div>
            )}
        </div>
    );
}

/** Below `xl` the summary is a disclosure above the actions (mounted only once opened). */
function SummaryDisclosure({ preview, state }: { preview?: AlertRequestPreview; state: AlertFormState }) {
    const [open, setOpen] = React.useState(false);

    const regionId = React.useId();

    return (
        <div className="flex flex-col gap-2 xl:hidden">
            <Button aria-controls={regionId} aria-expanded={open} className="-ml-2 h-auto min-h-7 max-w-full self-start py-1 text-left whitespace-normal" onClick={() => setOpen(!open)} size="sm" type="button" variant="ghost">
                {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
                Summary and request body
            </Button>
            {open && <div className="rounded-lg border p-3" id={regionId}><AlertFormSummaryPanel preview={preview} state={state} /></div>}
        </div>
    );
}

/**
 * The alert form (pure; `/alerts/new` and `/alerts/$id?edit=true`; ui-redesign task 13): sections named by what they
 * do — "What to watch" (the type: 18 in 8 groups, fixed on edit), "Condition" (the type's main fields from
 * `CONDITION_FIELDS`, list fields as chip inputs, the rest under "More conditions"; the indicator's template or
 * structured condition), "When it fires" (mode, cooldowns, re-arm; "More trigger options"), "Delivery" (destinations,
 * end user — an existing one suggested —, reference; "Metadata"). Beside it from `xl` the summary: the form in words and
 * the request body (`preview`); below `xl` a disclosure above the actions, which stay pinned to the bottom of the
 * window. Field errors sit under their field (their disclosure opens; the first one is scrolled into view); `notice`
 * above the buttons (a conflict, a quota, the Check result). "Check" = `validate_only` (nothing created).
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
    preview,
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
    /** The request the form sends (method, path, body), shown in the summary; absent = the sentence only. */
    preview?: AlertRequestPreview;
    /** The script version picker's data (A4, `script` alerts); absent = the id text field. */
    scriptOptions?: ScriptOptions;
    state: AlertFormState;
    templates: TemplatesState;
}) {
    const formRef = React.useRef<HTMLFormElement>(null);

    // The first error in view after a refused Check / Create (its disclosure is open by then: `forceOpen`).
    React.useEffect(() => {
        if (Object.keys(errors).length === 0) return;

        const first = formRef.current?.querySelector<HTMLElement>("[role=\"alert\"]");

        // jsdom has no `scrollIntoView`: read it as optional.
        const target: null | Partial<Pick<HTMLElement, "scrollIntoView">> | undefined = first?.closest<HTMLElement>("[data-field]");

        target?.scrollIntoView?.({ block: "center" });
    }, [errors]);

    const set = (patch: Partial<AlertFormState>) => onChange({ ...state, ...patch });

    const fields: ReadonlyArray<ConditionFieldSpec> = CONDITION_FIELDS[state.type].filter((spec) => {
        if (state.type !== "indicator") return true;

        return state.indicatorMode === "template" ? !INDICATOR_STRUCTURED_FIELDS.includes(spec.name) : spec.name !== "template";
    });

    if (state.type === "macro" && macroAccess !== "available") return <MacroAvailabilityNotice access={macroAccess} />;

    const busy = pending.check || pending.submit;

    const conditionField = (spec: ConditionFieldSpec) => {
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
    };

    const mainFields = fields.filter(spec => !MORE_CONDITION_FIELDS.has(spec.name));

    const moreFields = fields.filter(spec => MORE_CONDITION_FIELDS.has(spec.name));

    const triggerFields = triggerFieldsFor(state.type);

    const mainTrigger = triggerFields.filter(spec => !MORE_TRIGGER_FIELDS.has(spec.name));

    const moreTrigger = triggerFields.filter(spec => MORE_TRIGGER_FIELDS.has(spec.name));

    const triggerField = (spec: (typeof triggerFields)[number]) => (
        <FieldInput
            error={errors[`trigger.${spec.name}`]}
            fieldKey={`trigger.${spec.name}`}
            key={spec.name}
            onChange={value => set({ trigger: { ...state.trigger, [spec.name]: typeof value === "string" ? value : value.join(",") } })}
            spec={spec}
            value={state.trigger[spec.name]}
        />
    );

    return (
        <form
            className="grid gap-6 xl:grid-cols-[minmax(0,48rem)_minmax(0,1fr)] xl:items-start xl:gap-8"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();

                if (!busy) onSubmit();
            }}
            ref={formRef}
        >
            <div className="flex min-w-0 flex-col gap-4">
                <FormSection title="What to watch">
                    <TypePicker disabled={mode === "edit"} macroAvailable={macroAccess === "available"} onChange={type => set({ type, ...(type === "macro" && !state.condition.macro_events ? { condition: { ...state.condition, macro_events: ["macro.released", "macro.revised"] } } : {}) })} type={state.type} />
                    {mode === "edit" && <p className="text-muted-foreground text-xs">The type of an alert never changes; duplicate it to start from another type.</p>}
                </FormSection>
                <FormSection title="Condition">
                    {state.type === "indicator" && (
                        <div aria-label="Indicator condition" className="flex flex-wrap gap-2" role="radiogroup">
                            {(["template", "structured"] as const).map(indicatorMode => (
                                <Button aria-checked={state.indicatorMode === indicatorMode} key={indicatorMode} onClick={() => set({ indicatorMode })} role="radio" size="sm" type="button" variant={state.indicatorMode === indicatorMode ? "default" : "outline"}>
                                    {indicatorMode === "template" ? "Built-in template" : "Structured condition"}
                                </Button>
                            ))}
                        </div>
                    )}
                    <div className={FIELD_GRID_CLASS}>
                        {state.type === "macro" && <MacroConditionFields condition={state.condition} errors={errors} onChange={condition => set({ condition })} />}
                        {state.type !== "macro" && mainFields.map(conditionField)}
                    </div>
                    {state.type !== "macro" && moreFields.length > 0 && (
                        <Disclosure
                            forceOpen={errorUnder(errors, moreFields.map(spec => `condition.${spec.name}`))}
                            initialOpen={moreFields.some(spec => hasText(state.condition[spec.name]))}
                            label={`More conditions (${moreFields.map(spec => spec.label.toLowerCase()).join(", ")})`}
                        >
                            {moreFields.map(conditionField)}
                        </Disclosure>
                    )}
                    {errors.condition && <p className="text-destructive text-xs" role="alert">{errors.condition}</p>}
                </FormSection>
                <FormSection title="When it fires">
                    <div className={FIELD_GRID_CLASS}>{mainTrigger.map(triggerField)}</div>
                    <Disclosure
                        forceOpen={errorUnder(errors, [...moreTrigger.map(spec => `trigger.${spec.name}`), "trigger.active_window"])}
                        initialOpen={moreTrigger.some(spec => hasText(state.trigger[spec.name])) || state.window.type !== ""}
                        label="More trigger options (max fires, expiry, schedule, active window)"
                    >
                        {moreTrigger.map(triggerField)}
                        <ActiveWindowFields errors={errors} onChange={window => set({ window })} window={state.window} />
                    </Disclosure>
                    {errors.trigger && <p className="text-destructive text-xs" role="alert">{errors.trigger}</p>}
                </FormSection>
                <FormSection title="Delivery">
                    <div className={FIELD_GRID_CLASS}>
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
                        <FieldShell error={errors.external_user_id} help="Your end user's id (filters lists and events): pick an existing one or type a new id (the alert creates it)." helpMode="focus" htmlFor={fieldId("external_user_id")} label="End user id">
                            <AlertUserPicker id={fieldId("external_user_id")} onChange={externalUserId => set({ externalUserId })} options={endUserOptions} value={state.externalUserId} />
                        </FieldShell>
                        <FieldShell error={errors.client_reference_id} help="Your id of the alert, unique per account (a second create with it returns the live alert)." helpMode="focus" htmlFor={fieldId("client_reference_id")} label="Client reference id">
                            <Input id={fieldId("client_reference_id")} onChange={event => set({ clientReferenceId: event.target.value })} value={state.clientReferenceId} />
                        </FieldShell>
                    </div>
                    <Disclosure forceOpen={Boolean(errors.metadata)} initialOpen={state.metadata.length > 0} label="Metadata">
                        <MetadataFields error={errors.metadata} onChange={metadata => set({ metadata })} rows={state.metadata} />
                    </Disclosure>
                </FormSection>
                {errors.form && <p className="text-destructive" role="alert">{errors.form}</p>}
                {notice}
                <SummaryDisclosure preview={preview} state={state} />
                {/* Pinned to the bottom of the window while the form is longer than it (phone, long types). */}
                <div className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-2 border-t px-4 py-3 backdrop-blur sm:-mx-0 sm:px-0" data-testid="alert-form-actions">
                    <Button disabled={busy} type="submit">{pending.submit ? "Saving…" : mode === "create" ? "Create alert" : "Save changes"}</Button>
                    {onCheck && <Button disabled={busy} onClick={onCheck} type="button" variant="outline">{pending.check ? "Checking…" : "Check"}</Button>}
                    {onCancel && <Button disabled={busy} onClick={onCancel} type="button" variant="ghost">Cancel</Button>}
                </div>
            </div>
            <aside aria-label="Summary" className="bg-card hidden rounded-lg border p-4 xl:sticky xl:top-[calc(var(--app-topbar-height,0px)+1.5rem)] xl:block">
                <h3 className="text-section mb-3">Summary</h3>
                <AlertFormSummaryPanel preview={preview} state={state} />
            </aside>
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
                        <Input aria-label={`Metadata key ${index + 1}`} className="w-32 sm:w-40" onChange={event => onChange(rows.map((item, at) => (at === index ? { ...item, key: event.target.value } : item)))} placeholder="key" value={row.key} />
                        <Input aria-label={`Metadata value ${index + 1}`} onChange={event => onChange(rows.map((item, at) => (at === index ? { ...item, value: event.target.value } : item)))} placeholder="value" value={row.value} />
                        <Button aria-label={`Remove metadata ${index + 1}`} onClick={() => onChange(rows.filter((_, at) => at !== index))} size="sm" type="button" variant="ghost">Remove</Button>
                    </div>
                ))}
                <Button className="self-start" onClick={() => onChange([...rows, { key: "", value: "" }])} size="sm" type="button" variant="outline">Add a key</Button>
            </div>
        </FieldShell>
    );
}
