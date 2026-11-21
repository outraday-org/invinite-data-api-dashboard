import type * as React from "react";

import type { DestinationErrors, DestinationFormState, HeadersMode } from "@/lib/alerts/destinations";

import { FieldShell } from "@/components/alerts/alert-form-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    DESTINATION_KINDS,
    DESTINATION_PRESETS,
    DIGEST_MAX,
    DIGEST_MIN,
    HEADER_VALUE_MAX,
    HEADERS_MAX,
    KIND_INFO,
    PRESET_INFO,
    RATE_DEFAULT,
    RATE_MAX,
    RATE_MIN,
} from "@/lib/alerts/destinations";

const fieldId = (key: string) => `destination-field-${key}`;

/** Two or three choices as a radio group of buttons. */
function Choice<T extends string>({ label, onChange, options, value }: { label: string; onChange: (value: T) => void; options: ReadonlyArray<{ label: string; value: T }>; value: T }) {
    return (
        <div aria-label={label} className="flex flex-wrap gap-2" role="radiogroup">
            {options.map(option => (
                <Button aria-checked={value === option.value} key={option.value} onClick={() => onChange(option.value)} role="radio" size="sm" type="button" variant={value === option.value ? "default" : "outline"}>
                    {option.label}
                </Button>
            ))}
        </div>
    );
}

const HEADER_MODES: ReadonlyArray<{ label: string; value: HeadersMode }> = [
    { label: "Keep the stored headers", value: "keep" },
    { label: "Replace them", value: "replace" },
    { label: "Remove all", value: "remove" },
];

/**
 * The custom headers: name + a write-only value (`type="password"`, no autofill; the API never returns a value). On
 * edit the stored names are shown and kept unless the user replaces or removes them — a replacement is the whole set.
 */
function HeaderFields({ error, mode, onChange, state, storedNames }: { error?: string; mode: "create" | "edit"; onChange: (patch: Partial<DestinationFormState>) => void; state: DestinationFormState; storedNames: ReadonlyArray<string> }) {
    const rows = state.headerRows;

    const editingRows = mode === "create" || state.headersMode === "replace";

    return (
        <FieldShell error={error} help={`At most ${HEADERS_MAX} headers, values up to ${HEADER_VALUE_MAX.toLocaleString("en-US")} characters, stored encrypted. Values are write-only: never shown again, not even here.`} label="Custom headers" wide>
            <div className="flex flex-col gap-2">
                {mode === "edit" && (
                    <>
                        <p data-testid="stored-header-names">
                            {storedNames.length > 0 ? `Stored: ${storedNames.join(", ")} (values hidden).` : "No custom headers are stored."}
                        </p>
                        <Choice label="Stored headers" onChange={headersMode => onChange({ headerRows: headersMode === "replace" ? rows : [], headersMode })} options={HEADER_MODES} value={state.headersMode} />
                        {state.headersMode === "replace" && <p className="text-muted-foreground">The headers below replace every stored header: enter each one you want to keep with its value.</p>}
                        {state.headersMode === "remove" && <p className="text-muted-foreground">Every stored header is removed on save.</p>}
                    </>
                )}
                {editingRows && rows.map((row, index) => (
                    // Rows have no id of their own; the position is the identity while the list is edited.

                    <div className="flex flex-wrap gap-2 sm:flex-nowrap" key={index}>
                        <Input
                            aria-label={`Header name ${index + 1}`}
                            autoComplete="off"
                            className="sm:w-48"
                            onChange={event => onChange({ headerRows: rows.map((item, at) => (at === index ? { ...item, name: event.target.value } : item)) })}
                            placeholder="X-Receiver-Token"
                            spellCheck={false}
                            value={row.name}
                        />
                        <Input
                            aria-label={`Header value ${index + 1}`}
                            autoComplete="new-password"
                            className="min-w-0 flex-1"
                            data-1p-ignore
                            data-lpignore="true"
                            onChange={event => onChange({ headerRows: rows.map((item, at) => (at === index ? { ...item, value: event.target.value } : item)) })}
                            placeholder="value"
                            spellCheck={false}
                            type="password"
                            value={row.value}
                        />
                        <Button aria-label={`Remove header ${index + 1}`} onClick={() => onChange({ headerRows: rows.filter((_, at) => at !== index) })} size="sm" type="button" variant="ghost">Remove</Button>
                    </div>
                ))}
                {editingRows && rows.length < HEADERS_MAX && (
                    <Button className="self-start" onClick={() => onChange({ headerRows: [...rows, { name: "", value: "" }] })} size="sm" type="button" variant="outline">Add a header</Button>
                )}
            </div>
        </FieldShell>
    );
}

/**
 * The destination form (pure; create and edit): URL (https, port 443 — the API refuses a private address itself),
 * kind, preset, description, custom headers (write-only values), body template, rate limit and digest window, each with
 * the contract's bounds. Errors sit under their field; `notice` above the buttons.
 */
export function DestinationFormView({
    errors,
    mode,
    notice,
    onCancel,
    onChange,
    onSubmit,
    pending,
    state,
    storedHeaderNames = [],
}: {
    errors: DestinationErrors;
    mode: "create" | "edit";
    notice?: React.ReactNode;
    onCancel?: () => void;
    onChange: (state: DestinationFormState) => void;
    onSubmit: () => void;
    pending: boolean;
    state: DestinationFormState;
    /** Edit: the stored `header_names`. */
    storedHeaderNames?: ReadonlyArray<string>;
}) {
    const set = (patch: Partial<DestinationFormState>) => onChange({ ...state, ...patch });

    return (
        <form
            autoComplete="off"
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();

                if (!pending) onSubmit();
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <FieldShell error={errors.url} help="https only, port 443, a public address (the API refuses private ones)." htmlFor={fieldId("url")} label="Endpoint URL" wide>
                    <Input id={fieldId("url")} inputMode="url" onChange={event => set({ url: event.target.value })} placeholder="https://hooks.example.com/invinite-alerts" spellCheck={false} value={state.url} />
                </FieldShell>
                <FieldShell help={KIND_INFO[state.kind].meaning} label="Kind">
                    <Choice label="Kind" onChange={kind => set({ kind })} options={DESTINATION_KINDS.map(kind => ({ label: KIND_INFO[kind].label, value: kind }))} value={state.kind} />
                </FieldShell>
                <FieldShell help={PRESET_INFO[state.preset].meaning} label="Preset">
                    <Choice label="Preset" onChange={preset => set({ preset })} options={DESTINATION_PRESETS.map(preset => ({ label: PRESET_INFO[preset].label, value: preset }))} value={state.preset} />
                </FieldShell>
                <FieldShell error={errors.description} help="Your note, at most 500 characters." htmlFor={fieldId("description")} label="Description" wide>
                    <Input id={fieldId("description")} onChange={event => set({ description: event.target.value })} placeholder="Production alert receiver" value={state.description} />
                </FieldShell>
                <FieldShell error={errors.max_events_per_minute} help={`Events per minute it receives at most (${RATE_MIN}–${RATE_MAX.toLocaleString("en-US")}; default ${RATE_DEFAULT}). Events over it stay queued and go out as the limit allows, never dropped.`} htmlFor={fieldId("rate")} label="Rate limit (events / minute)">
                    <Input id={fieldId("rate")} inputMode="numeric" onChange={event => set({ maxEventsPerMinute: event.target.value })} placeholder={String(RATE_DEFAULT)} value={state.maxEventsPerMinute} />
                </FieldShell>
                <FieldShell error={errors.digest_seconds} help={`Hold new events until the oldest is this many seconds old (${DIGEST_MIN}–${DIGEST_MAX.toLocaleString("en-US")}), then send them as ONE alert.fired.batch. Empty = off. Not with the Claude routine preset.`} htmlFor={fieldId("digest")} label="Digest window (seconds)">
                    <Input disabled={state.preset === "claude_routine" && state.digestSeconds === ""} id={fieldId("digest")} inputMode="numeric" onChange={event => set({ digestSeconds: event.target.value })} placeholder="Off" value={state.digestSeconds} />
                </FieldShell>
                <HeaderFields error={errors.headers} mode={mode} onChange={set} state={state} storedNames={storedHeaderNames} />
                <FieldShell error={errors.body_template} help="A custom body template, at most 16 KB. Empty = none (on edit: removes the stored one)." htmlFor={fieldId("template")} label="Body template" wide>
                    <Textarea className="font-mono" id={fieldId("template")} onChange={event => set({ bodyTemplate: event.target.value })} rows={4} spellCheck={false} value={state.bodyTemplate} />
                </FieldShell>
            </div>
            {errors.form && <p className="text-destructive" role="alert">{errors.form}</p>}
            {notice}
            <div className="flex flex-wrap gap-2">
                <Button disabled={pending} type="submit">{pending ? "Saving…" : mode === "create" ? "Create destination" : "Save changes"}</Button>
                {onCancel && <Button disabled={pending} onClick={onCancel} type="button" variant="ghost">Cancel</Button>}
            </div>
        </form>
    );
}
