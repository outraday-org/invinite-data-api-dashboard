import * as React from "react";
import { toast } from "sonner";

import type { DefaultsFormState, FormErrors } from "@/lib/alerts/alert-users";
import type { AlertUserDefaults } from "@/lib/api/types";

import { AlertsState } from "@/components/alerts/alert-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fromDefaults, LIMIT_SPECS, limitValueText, toDefaultsBody } from "@/lib/alerts/alert-users";
import { errorDescription } from "@/lib/api/errors";
import { useApiMutation } from "@/lib/api/mutations";
import { ALERT_USER_QUERY_KEYS, useAlertUserDefaults } from "@/lib/api/queries";
import { formatInstant } from "@/lib/format";

/** The anchor of the panel on `/alerts/users` (linked from `/account`). */
export const DEFAULTS_ANCHOR = "defaults";

/**
 * The account's end-user defaults (pure): the limits a new end user gets — and every end user without its own value —
 * null = no limit; Edit turns the values into fields (empty = no limit) and Save sends the changed ones only.
 */
export function AlertUserDefaultsView({
    defaults,
    editing,
    errors,
    onCancel,
    onChange,
    onEdit,
    onSave,
    pending,
    state,
}: {
    defaults: AlertUserDefaults;
    editing: boolean;
    errors: FormErrors;
    onCancel: () => void;
    onChange: (state: DefaultsFormState) => void;
    onEdit: () => void;
    onSave: () => void;
    pending: boolean;
    state: DefaultsFormState;
}) {
    return (
        <form
            className="flex flex-col gap-3"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();

                if (!pending) onSave();
            }}
        >
            <dl className="grid gap-3 sm:grid-cols-3">
                {LIMIT_SPECS.map(spec => (
                    <div className="flex min-w-0 flex-col gap-1" data-field={`default-${spec.field}`} key={spec.field}>
                        <dt className="font-medium">
                            {editing ? <label htmlFor={`default-${spec.field}`}>{spec.label}</label> : spec.label}
                        </dt>
                        <dd className="flex flex-col gap-1">
                            {editing
                                ? <Input id={`default-${spec.field}`} inputMode="numeric" onChange={event => onChange({ ...state, [spec.field]: event.target.value })} placeholder="No limit" value={state[spec.field]} />
                                : <span className="text-sm tabular-nums">{limitValueText(defaults[spec.field])}</span>}
                            <span className="text-muted-foreground">{spec.help}</span>
                            {errors[spec.field] && <span className="text-destructive" role="alert">{errors[spec.field]}</span>}
                        </dd>
                    </div>
                ))}
            </dl>
            {errors.form && <p className="text-destructive" role="alert">{errors.form}</p>}
            <div className="flex flex-wrap items-center gap-2">
                {editing
                    ? (
                            <>
                                <Button disabled={pending} size="sm" type="submit">{pending ? "Saving…" : "Save defaults"}</Button>
                                <Button disabled={pending} onClick={onCancel} size="sm" type="button" variant="ghost">Cancel</Button>
                            </>
                        )
                    : <Button onClick={onEdit} size="sm" type="button" variant="outline">Edit defaults</Button>}
                <span className="text-muted-foreground">
                    {defaults.updated_at ? `Last changed ${formatInstant(defaults.updated_at)}.` : "Never set."}
                    {" A default lowered below an end user's count keeps its alerts and refuses new ones."}
                </span>
            </div>
        </form>
    );
}

/** `GET` / `PATCH /v1/me/alert-user-defaults` on the end users page (anchor `#defaults`). */
export function AlertUserDefaultsPanel() {
    const query = useAlertUserDefaults();

    const [editing, setEditing] = React.useState(false);

    const [state, setState] = React.useState<DefaultsFormState>({ max_active_alerts: "", max_fires_per_day: "", max_script_alerts: "" });

    const [errors, setErrors] = React.useState<FormErrors>({});

    // The effective limits of every end user follow the defaults: the list is refetched too.
    const save = useApiMutation("updateAlertUserDefaults", { invalidates: [ALERT_USER_QUERY_KEYS.defaults, ALERT_USER_QUERY_KEYS.users] });

    const loaded = query.data;

    const onSave = async () => {
        if (!loaded) return;

        const { body, errors: local } = toDefaultsBody(state, loaded);

        setErrors(local);

        if (Object.keys(local).length > 0) return;

        if (!body) {
            setEditing(false);

            return;
        }

        try {
            await save.mutateAsync({ body });

            toast.success("End-user defaults saved");

            setEditing(false);
        }
        catch (error) {
            setErrors({ form: errorDescription(error as Error) });
        }
    };

    return (
        <section aria-labelledby="alert-user-defaults-title" className="flex scroll-mt-24 flex-col gap-3 rounded-xl border p-4" id={DEFAULTS_ANCHOR}>
            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold" id="alert-user-defaults-title">End-user defaults</h3>
                <p className="text-muted-foreground">The limits of every end user without its own value, and of every new one. Empty = no limit.</p>
            </div>
            {loaded
                ? (
                        <AlertUserDefaultsView
                            defaults={loaded}
                            editing={editing}
                            errors={errors}
                            onCancel={() => {
                                setEditing(false);

                                setErrors({});
                            }}
                            onChange={setState}
                            onEdit={() => {
                                setState(fromDefaults(loaded));

                                setEditing(true);
                            }}
                            onSave={() => void onSave()}
                            pending={save.isPending}
                            state={state}
                        />
                    )
                : query.error ? <AlertsState error={query.error} title="Failed to load the end-user defaults" /> : <Skeleton className="h-20 w-full" />}
        </section>
    );
}
