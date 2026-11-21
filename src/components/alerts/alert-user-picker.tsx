import * as React from "react";

import type { AlertUser } from "@/lib/api/types";

import { Input } from "@/components/ui/input";
import { ALERT_USER_STATUS_INFO } from "@/lib/alerts/alert-users";
import { useAlertUserSuggestions } from "@/lib/api/queries";

/** How long typing rests before the suggestions are asked (one `listAlertUsers` page per pause). */
const SUGGEST_DELAY_MS = 300;

export type AlertUserOption = { id: string; label: string };

/** The options of existing end users (pure): the id, its display name and a non-active status as the label. */
export function alertUserOptions(users: ReadonlyArray<Pick<AlertUser, "display_name" | "external_user_id" | "status">>): Array<AlertUserOption> {
    return users.map(user => ({
        id: user.external_user_id,
        label: [user.display_name, user.status === "active" ? null : ALERT_USER_STATUS_INFO[user.status].label].filter(Boolean).join(" · "),
    }));
}

/**
 * The alert form's end-user suggestions: existing end users whose id starts with the typed text (the API's `q`
 * prefix), asked once typing rests; idle while the field is empty (opening the form asks nothing).
 */
export function useAlertUserOptions(text: string): Array<AlertUserOption> {
    const [prefix, setPrefix] = React.useState(text);

    React.useEffect(() => {
        const timer = setTimeout(() => setPrefix(text), SUGGEST_DELAY_MS);

        return () => clearTimeout(timer);
    }, [text]);

    const suggestions = useAlertUserSuggestions(prefix.slice(0, 200), prefix.length > 0);

    return alertUserOptions(suggestions.data?.data ?? []);
}

/**
 * The end-user field (pure): free text (a new id is created by the alert: PATCH semantics on the API's side) with the
 * existing end users as suggestions (`<datalist>`: typing filters, picking fills the id).
 */
export function AlertUserPicker({ id, onChange, options, value }: { id: string; onChange: (value: string) => void; options: ReadonlyArray<AlertUserOption>; value: string }) {
    const listId = `${id}-options`;

    return (
        <>
            <Input autoComplete="off" id={id} list={listId} onChange={event => onChange(event.target.value)} value={value} />
            <datalist data-testid="alert-user-options" id={listId}>
                {options.map(option => <option key={option.id} label={option.label || undefined} value={option.id} />)}
            </datalist>
        </>
    );
}
