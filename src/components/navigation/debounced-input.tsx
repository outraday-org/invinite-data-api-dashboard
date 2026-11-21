import * as React from "react";

import { Input } from "@/components/ui/input";

/**
 * A text filter that commits 300 ms after the last keystroke (a list page keeps its query in the URL; every change is
 * a request). `value` = the committed text; a change from outside (back button) replaces the draft.
 */
export function DebouncedInput({
    "aria-label": ariaLabel,
    className,
    onCommit,
    placeholder,
    value,
}: {
    "aria-label": string;
    "className"?: string;
    "onCommit": (value: string) => void;
    "placeholder"?: string;
    "value": string;
}) {
    const [draft, setDraft] = React.useState(value);

    const [committed, setCommitted] = React.useState(value);

    // The last text this field committed itself.
    const [sent, setSent] = React.useState<null | string>(null);

    // Adopt a committed value that changed outside (back button; state, not an effect: render stays pure). Our own
    // commit arriving keeps the draft as typed: its trailing space, and what was typed while the URL updated.
    if (committed !== value) {
        setCommitted(value);

        // Our commit is consumed once: a later back / forward to the same text is adopted again.
        if (value === sent) setSent(null);
        else setDraft(value);
    }

    React.useEffect(() => {
        if (draft.trim() === value) return;

        const timer = window.setTimeout(() => {
            setSent(draft.trim());

            onCommit(draft.trim());
        }, 300);

        return () => window.clearTimeout(timer);
    }, [draft, onCommit, value]);

    return <Input aria-label={ariaLabel} className={className} onChange={event => setDraft(event.target.value)} placeholder={placeholder} value={draft} />;
}
