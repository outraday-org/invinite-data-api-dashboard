import { useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import type { AlertFormState, FieldErrors } from "@/lib/alerts/alert-form";
import type { Alert, AlertWriteDone } from "@/lib/api/types";

import { useAlertFormPickers } from "@/components/alerts/alert-form-pickers";
import { AlertFormView } from "@/components/alerts/alert-form-view";
import { LimitNotice } from "@/components/alerts/alert-parts";
import { useAlertUserOptions } from "@/components/alerts/alert-user-picker";
import { useMacroAccess } from "@/components/macro/macro-availability";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { fieldErrorsOf, toCreateBody, toUpdateBody } from "@/lib/alerts/alert-form";
import { ApiRequestError, errorDescription } from "@/lib/api/errors";
import { useApiMutation, useIdempotencyKey } from "@/lib/api/mutations";
import { ALERT_QUERY_KEYS, ALERT_USER_QUERY_KEYS, useAlertsQuota, useAlertTemplates } from "@/lib/api/queries";

const isAlert = (value: Alert | AlertWriteDone): value is Alert => "type" in value;

/** What a refused write shows: field errors for a 400, else one outcome (a conflict, a limit, any other error). */
export type WriteOutcome = null | { error: unknown; kind: "conflict" | "error" } | { kind: "valid" };

/** A refused write on the form: a 400's problems under their fields, a 409 `conflict` as its own notice, else an outcome. */
export function outcomeOf(error: unknown): { errors: FieldErrors; outcome: WriteOutcome } {
    if (error instanceof ApiRequestError && error.status === 400) return { errors: fieldErrorsOf(error), outcome: null };

    if (error instanceof ApiRequestError && error.status === 409 && error.code === "conflict") return { errors: {}, outcome: { error, kind: "conflict" } };

    return { errors: {}, outcome: { error, kind: "error" } };
}

const LIMIT_CODES = new Set(["alert_user_limit_reached", "alert_user_paused", "Forbidden", "plan_required"]);

/** A quota / plan / end-user refusal (`LimitNotice`), not a field or a transport problem. */
const isLimit = (error: unknown) => error instanceof ApiRequestError && LIMIT_CODES.has(error.code);

/** A limit refusal with the quota's numbers, read on request (one `limit=1` list page, 1 credit). */
function LimitWithQuota({ error }: { error: unknown }) {
    const [wantQuota, setWantQuota] = React.useState(false);

    const quota = useAlertsQuota(wantQuota);

    return <LimitNotice error={error} onLoadQuota={() => setWantQuota(true)} quota={quota.data?.meta.quota ?? null} />;
}

/** The outcome above the form's buttons: valid (Check), a conflict with Reload, a limit, else the error card. */
function WriteOutcomeNotice({ onReload, outcome }: { onReload?: () => void; outcome: WriteOutcome }) {
    if (!outcome) return null;

    if (outcome.kind === "valid") return <Notice badge="Valid" title="The API accepted this alert">Nothing was created: Check runs every test of a create (body, plan, coverage, destinations, quotas, end user) without writing.</Notice>;

    if (outcome.kind === "conflict") {
        return (
            <Notice badge="Conflict" title="This alert changed elsewhere since you opened it">
                <p>Your changes were not saved. Reload to edit the current version (your edits here are dropped).</p>
                {onReload && <Button className="mt-2" onClick={onReload} size="sm" type="button" variant="outline">Reload the alert</Button>}
            </Notice>
        );
    }

    if (isLimit(outcome.error)) return <LimitWithQuota error={outcome.error} />;

    return <ErrorState message={errorDescription(outcome.error as Error)} title="The API refused the alert" />;
}

/**
 * `/alerts/new`: the form, "Check" (`validate_only`, nothing created) and Create with ONE `Idempotency-Key` per
 * submission (a double click or a retry after a lost answer creates one alert). A created alert opens its page.
 */
export function CreateAlertForm({ initial, initialScriptId }: { initial: AlertFormState; initialScriptId?: string }) {
    const navigate = useNavigate();

    const macroAccess = useMacroAccess();

    const [state, setState] = React.useState(initial);

    const [errors, setErrors] = React.useState<FieldErrors>({});

    const [outcome, setOutcome] = React.useState<WriteOutcome>(null);

    const templates = useAlertTemplates(state.type === "indicator");

    const endUserOptions = useAlertUserOptions(state.externalUserId);

    const pickers = useAlertFormPickers(state, setState, initialScriptId);

    // A create naming a new end user creates it; an end user's usage counts its alerts (A4).
    const create = useApiMutation("createAlert", { invalidates: [ALERT_QUERY_KEYS.list, ALERT_USER_QUERY_KEYS.users] });

    const check = useApiMutation("createAlert", { invalidates: [] });

    const idempotency = useIdempotencyKey();

    const bodyOrErrors = () => {
        const { body, errors: local } = toCreateBody(state, templates.data?.data ?? []);

        setErrors(local);

        setOutcome(null);

        return Object.keys(local).length > 0 ? null : body;
    };

    const fail = (error: unknown) => {
        const next = outcomeOf(error);

        setErrors(next.errors);

        setOutcome(next.outcome);
    };

    const onSubmit = async () => {
        const body = bodyOrErrors();

        if (!body) return;

        const idempotencyKey = idempotency.keyFor(body);

        try {
            const result = await create.mutateAsync({ body, idempotencyKey });

            idempotency.settle(null);

            if (!isAlert(result)) return;

            toast.success(`Alert ${result.id} saved`);

            void navigate({ params: { id: result.id }, to: "/alerts/$id" });
        }
        catch (error) {
            idempotency.settle(error);

            fail(error);
        }
    };

    const onCheck = async () => {
        const body = bodyOrErrors();

        if (!body) return;

        try {
            await check.mutateAsync({ body, validateOnly: true });

            setOutcome({ kind: "valid" });
        }
        catch (error) {
            fail(error);
        }
    };

    return (
        <>
            <AlertFormView
                destinationOptions={pickers.destinationOptions}
                endUserOptions={endUserOptions}
                errors={errors}
                macroAccess={macroAccess}
                mode="create"
                notice={<WriteOutcomeNotice outcome={outcome} />}
                onChange={(next) => {
                    setState(next);

                    setOutcome(null);
                }}
                onCheck={() => void onCheck()}
                onSubmit={() => void onSubmit()}
                pending={{ check: check.isPending, submit: create.isPending }}
                preview={{ body: toCreateBody(state, templates.data?.data ?? []).body, method: "POST", path: "/v1/alerts" }}
                scriptOptions={pickers.scriptOptions}
                state={state}
                templates={{ data: templates.data?.data ?? [], error: templates.error, isLoading: templates.isLoading }}
            />
            {pickers.dialog}
        </>
    );
}

/**
 * `/alerts/$id?edit=true`: the form of the stored alert; Save sends the whole condition / trigger / delivery with the
 * `version` the form was loaded at — a 409 `conflict` says "changed elsewhere" and offers a reload, never a blind retry.
 */
export function EditAlertForm({ alert, initial, onDone, onReload }: { alert: Alert; initial: AlertFormState; onDone: () => void; onReload: () => void }) {
    const macroAccess = useMacroAccess();

    const [state, setState] = React.useState(initial);

    // The version the form was loaded at: a background refetch of the alert must not move it (the conflict check).
    const [version] = React.useState(alert.version);

    const [errors, setErrors] = React.useState<FieldErrors>({});

    const [outcome, setOutcome] = React.useState<WriteOutcome>(null);

    const templates = useAlertTemplates(state.type === "indicator");

    const endUserOptions = useAlertUserOptions(state.externalUserId);

    const pickers = useAlertFormPickers(state, setState);

    const update = useApiMutation("updateAlert", { invalidates: [ALERT_QUERY_KEYS.list, ALERT_QUERY_KEYS.alert, ALERT_USER_QUERY_KEYS.users] });

    const onSubmit = async () => {
        const { body, errors: local } = toUpdateBody(state, version, templates.data?.data ?? []);

        setErrors(local);

        setOutcome(null);

        if (Object.keys(local).length > 0) return;

        try {
            await update.mutateAsync({ body, id: alert.id });

            toast.success(`Alert ${alert.id} saved`);

            onDone();
        }
        catch (error) {
            const next = outcomeOf(error);

            setErrors(next.errors);

            setOutcome(next.outcome);
        }
    };

    return (
        <>
            <AlertFormView
                destinationOptions={pickers.destinationOptions}
                endUserOptions={endUserOptions}
                errors={errors}
                macroAccess={macroAccess}
                mode="edit"
                notice={<WriteOutcomeNotice onReload={onReload} outcome={outcome} />}
                onCancel={onDone}
                onChange={(next) => {
                    setState(next);

                    setOutcome(null);
                }}
                onSubmit={() => void onSubmit()}
                pending={{ check: false, submit: update.isPending }}
                preview={{ body: toUpdateBody(state, version, templates.data?.data ?? []).body, method: "PATCH", path: `/v1/alerts/${alert.id}` }}
                scriptOptions={pickers.scriptOptions}
                state={state}
                templates={{ data: templates.data?.data ?? [], error: templates.error, isLoading: templates.isLoading }}
            />
            {pickers.dialog}
        </>
    );
}
