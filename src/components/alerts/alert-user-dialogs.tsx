import * as React from "react";
import { toast } from "sonner";

import type { AlertUserFormState, FormErrors, ParsedBatch } from "@/lib/alerts/alert-users";
import type { BatchItemResult } from "@/lib/alerts/labels";
import type { AlertUser, AlertUserDefaults } from "@/lib/api/types";

import { BatchResultsView } from "@/components/alerts/alert-parts";
import { batchChunks } from "@/components/alerts/use-alert-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ALERT_USER_BATCH_MAX, BATCH_CSV_COLUMNS, batchPreviewText, LIMIT_SPECS, limitValueText, parseAlertUserBatch, toAlertUserBody } from "@/lib/alerts/alert-users";
import { ApiRequestError, errorDescription } from "@/lib/api/errors";
import { useApiMutation } from "@/lib/api/mutations";
import { ALERT_USER_QUERY_KEYS } from "@/lib/api/queries";

const fieldId = (key: string) => `alert-user-field-${key}`;

function Field({ children, error, help, htmlFor, label }: { children: React.ReactNode; error?: string; help?: string; htmlFor: string; label: string }) {
    return (
        <div className="flex min-w-0 flex-col gap-1" data-field={htmlFor}>
            <label className="font-medium" htmlFor={htmlFor}>{label}</label>
            {children}
            {help && <p className="text-muted-foreground">{help}</p>}
            {error && <p className="text-destructive" role="alert">{error}</p>}
        </div>
    );
}

/**
 * The fields of an end user (pure): its id (only when adding — PATCH creates a missing one), display name, the three
 * limits (empty = the account default, named with its value) and the metadata as JSON.
 */
export function AlertUserFormFields({ defaults, errors, mode, onChange, state }: { defaults: AlertUserDefaults | null; errors: FormErrors; mode: "create" | "edit"; onChange: (state: AlertUserFormState) => void; state: AlertUserFormState }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {mode === "create" && (
                <Field error={errors.external_user_id} help="Your own id of the end user: any text, 1–200 characters (kept exactly as typed)." htmlFor={fieldId("external_user_id")} label="End user id">
                    <Input id={fieldId("external_user_id")} onChange={event => onChange({ ...state, externalUserId: event.target.value })} value={state.externalUserId} />
                </Field>
            )}
            <Field error={errors.display_name} help="A name for your dashboards (empty = none)." htmlFor={fieldId("display_name")} label="Display name">
                <Input id={fieldId("display_name")} onChange={event => onChange({ ...state, displayName: event.target.value })} value={state.displayName} />
            </Field>
            {LIMIT_SPECS.map(spec => (
                <Field
                    error={errors[spec.field]}
                    help={`${spec.help} Empty = the account default (${defaults ? limitValueText(defaults[spec.field]).toLowerCase() : "see End-user defaults"}).`}
                    htmlFor={fieldId(spec.field)}
                    key={spec.field}
                    label={spec.label}
                >
                    <Input
                        id={fieldId(spec.field)}
                        inputMode="numeric"
                        onChange={event => onChange({ ...state, limits: { ...state.limits, [spec.field]: event.target.value } })}
                        placeholder="Account default"
                        value={state.limits[spec.field]}
                    />
                </Field>
            ))}
            <div className="sm:col-span-2">
                <Field error={errors.metadata} help="Your own key / value pairs as a JSON object (≤ 50 keys, ≤ 8 KB); replaces the stored object." htmlFor={fieldId("metadata")} label="Metadata">
                    <Textarea className="font-mono" id={fieldId("metadata")} onChange={event => onChange({ ...state, metadata: event.target.value })} placeholder={"{\"tier\": \"premium\"}"} rows={3} spellCheck={false} value={state.metadata} />
                </Field>
            </div>
        </div>
    );
}

/** A refused upsert on the dialog's fields (a 400's `param` / `errors[]` by field name, else `form`). */
export function upsertErrorsOf(error: unknown): FormErrors {
    if (!(error instanceof ApiRequestError)) return { form: errorDescription(error as Error) };

    const problems = error.status === 400 && error.body.errors?.length ? error.body.errors : [{ detail: error.message, param: error.body.param ?? null }];

    const known = new Set(["display_name", "external_user_id", "metadata", ...LIMIT_SPECS.map(spec => spec.field)]);

    const out: FormErrors = {};

    for (const problem of problems) {
        const key = problem.param && known.has(problem.param.split(".")[0]) ? problem.param.split(".")[0] : "form";

        out[key] = out[key] ? `${out[key]} ${problem.detail}` : problem.detail;
    }

    return out;
}

/**
 * Add or edit one end user (`PATCH /v1/alert-users/{id}`, an upsert): the dialog sends every field it shows; a
 * success closes it and refetches the end users.
 */
export function AlertUserEditDialog({ defaults, initial, mode, onOpenChange, onSaved, open }: { defaults: AlertUserDefaults | null; initial: AlertUserFormState; mode: "create" | "edit"; onOpenChange: (open: boolean) => void; onSaved?: (user: AlertUser) => void; open: boolean }) {
    const [state, setState] = React.useState(initial);

    const [errors, setErrors] = React.useState<FormErrors>({});

    const save = useApiMutation("updateAlertUser", { invalidates: [ALERT_USER_QUERY_KEYS.users] });

    const onSubmit = async () => {
        const { body, errors: local, id } = toAlertUserBody(state);

        setErrors(local);

        if (Object.keys(local).length > 0) return;

        try {
            const user = await save.mutateAsync({ body, externalUserId: id });

            toast.success(`${mode === "create" ? "Saved" : "Updated"} ${user.external_user_id}`);

            onSaved?.(user);

            onOpenChange(false);
        }
        catch (error) {
            setErrors(upsertErrorsOf(error));
        }
    };

    return (
        <Dialog onOpenChange={next => !save.isPending && onOpenChange(next)} open={open}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <form
                    className="flex flex-col gap-4"
                    noValidate
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (!save.isPending) void onSubmit();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{mode === "create" ? "Add end user" : `Edit ${state.externalUserId}`}</DialogTitle>
                        <DialogDescription>
                            {mode === "create"
                                ? "Creates the end user (or updates it when the id exists). Its alerts are created with this id as external_user_id."
                                : "Changes apply at once. A limit lowered below the current count keeps the existing alerts and refuses new ones."}
                        </DialogDescription>
                    </DialogHeader>
                    <AlertUserFormFields defaults={defaults} errors={errors} mode={mode} onChange={setState} state={state} />
                    {errors.form && <p className="text-destructive" role="alert">{errors.form}</p>}
                    <DialogFooter>
                        <Button disabled={save.isPending} onClick={() => onOpenChange(false)} type="button" variant="ghost">Cancel</Button>
                        <Button disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : mode === "create" ? "Add end user" : "Save changes"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Problems shown before anything is sent. */
export const BATCH_PROBLEMS_SHOWN = 10;

/** The preview of a pasted bulk upsert (pure): what will be sent, or the first problems. */
export function AlertUserBatchPreview({ parsed }: { parsed: ParsedBatch }) {
    if (parsed.format === null) return null;

    return (
        <div className="flex flex-col gap-1" data-testid="batch-preview" role="status">
            <p className={parsed.problems.length > 0 ? "font-medium text-destructive" : "font-medium"}>{batchPreviewText(parsed)}</p>
            {parsed.problems.length > 0 && (
                <ul className="flex flex-col gap-0.5 text-destructive">
                    {parsed.problems.slice(0, BATCH_PROBLEMS_SHOWN).map((problem, index) => (
                        // A problem has no id of its own; the list is rebuilt on every edit.

                        <li key={index}>{problem.item === 0 ? problem.message : `Item ${problem.item}: ${problem.message}`}</li>
                    ))}
                    {parsed.problems.length > BATCH_PROBLEMS_SHOWN && <li>{`… and ${parsed.problems.length - BATCH_PROBLEMS_SHOWN} more`}</li>}
                </ul>
            )}
        </div>
    );
}

const PLACEHOLDER = `external_user_id,display_name,max_active_alerts,max_script_alerts,max_fires_per_day
user_8812,Jane (premium),50,5,
user_9001,,10,0,null`;

/**
 * Bulk upsert (`POST /v1/alert-users:batch`): paste JSON (a list, or `{ "items": [...] }`) or CSV with a header row,
 * or pick a file; every item is checked against `AlertUserBatchItem` before anything is sent, a paste above 500 items
 * is sent as several requests (the preview says so first), and the per-item results are shown after.
 */
export function AlertUserBatchDialog({ onOpenChange, open }: { onOpenChange: (open: boolean) => void; open: boolean }) {
    const [text, setText] = React.useState("");

    const [outcome, setOutcome] = React.useState<null | { ids: Array<string>; results: Array<BatchItemResult> }>(null);

    const [stopped, setStopped] = React.useState<null | string>(null);

    const batch = useApiMutation("batchAlertUsers", { invalidates: [ALERT_USER_QUERY_KEYS.users] });

    const parsed = parseAlertUserBatch(text);

    const ready = parsed.items.length > 0 && parsed.problems.length === 0;

    const send = async () => {
        const ids = parsed.items.map(item => item.external_user_id);

        const results: Array<BatchItemResult> = [];

        setStopped(null);

        try {
            for (const [chunkIndex, chunk] of batchChunks(parsed.items, ALERT_USER_BATCH_MAX).entries()) {
                const answer = await batch.mutateAsync({ items: chunk });

                results.push(...answer.results.map(result => ({ ...result, index: result.index + chunkIndex * ALERT_USER_BATCH_MAX })));
            }
        }
        catch (error) {
            setStopped(`${errorDescription(error as Error)} — ${results.length} of ${ids.length} items had an answer.`);
        }

        setOutcome({ ids, results });
    };

    const onFile = async (file: File | undefined) => {
        if (file) setText(await file.text());
    };

    return (
        <Dialog onOpenChange={next => !batch.isPending && onOpenChange(next)} open={open}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Bulk create or update end users</DialogTitle>
                    <DialogDescription>
                        {`Paste JSON (a list of items, or { "items": [...] }) or CSV with the columns ${BATCH_CSV_COLUMNS.join(", ")}. An empty cell leaves the field as it is; null clears it (a limit then follows the account default). At most ${ALERT_USER_BATCH_MAX} items a request.`}
                    </DialogDescription>
                </DialogHeader>
                {outcome
                    ? (
                            <div className="flex flex-col gap-2">
                                {stopped && <p className="text-destructive" role="alert">{`The bulk upsert stopped: ${stopped}`}</p>}
                                {outcome.results.length > 0 && <BatchResultsView ids={outcome.ids} onDismiss={() => setOutcome(null)} results={outcome.results} />}
                                <DialogFooter>
                                    <Button onClick={() => setOutcome(null)} type="button" variant="outline">Paste another batch</Button>
                                    <Button onClick={() => onOpenChange(false)} type="button">Close</Button>
                                </DialogFooter>
                            </div>
                        )
                    : (
                            <div className="flex flex-col gap-3">
                                <Textarea aria-label="End users to create or update" className="min-h-40 font-mono" onChange={event => setText(event.target.value)} placeholder={PLACEHOLDER} spellCheck={false} value={text} />
                                <label className="flex flex-wrap items-center gap-2">
                                    <span className="text-muted-foreground">Or read a file:</span>
                                    <input accept=".csv,.json,text/csv,application/json,text/plain" aria-label="Read a CSV or JSON file" className="text-xs" onChange={event => void onFile(event.target.files?.[0])} type="file" />
                                </label>
                                <AlertUserBatchPreview parsed={parsed} />
                                <DialogFooter>
                                    <Button disabled={batch.isPending} onClick={() => onOpenChange(false)} type="button" variant="ghost">Cancel</Button>
                                    <Button disabled={!ready || batch.isPending} onClick={() => void send()} type="button">
                                        {batch.isPending ? "Sending…" : ready ? `Send ${parsed.items.length} end user${parsed.items.length === 1 ? "" : "s"}` : "Send"}
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}
            </DialogContent>
        </Dialog>
    );
}
