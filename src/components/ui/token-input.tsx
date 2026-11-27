import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/** Where a list text splits: commas and new lines only (keywords may hold spaces), or whitespace too (symbols, CIKs). */
export type TokenSeparators = "commas" | "commas-and-spaces";

const SPLIT: Record<TokenSeparators, RegExp> = { "commas": /[,\n]/, "commas-and-spaces": /[\s,]+/ };

/** The entries of a list text (pure): split, trimmed, empty ones dropped — the alert form's own list rule. */
export function splitTokens(text: string, separators: TokenSeparators): Array<string> {
    return text.split(SPLIT[separators]).map(item => item.trim()).filter(Boolean);
}

/** Entries → the list text (pure): `joiner` is what the form model writes (", " or a new line). */
export function joinTokens(tokens: ReadonlyArray<string>, joiner: string): string {
    return tokens.filter(Boolean).join(joiner);
}

/** Whether a typed text holds a separator, i.e. at least one finished entry (pure). */
const hasSeparator = (text: string, separators: TokenSeparators) => (separators === "commas" ? /[,\n]/ : /[\s,]/).test(text);

/**
 * A one-line chip input over a list TEXT (ui-redesign task 13): `value` in and out is the same separator-joined string
 * the caller's model already uses, so nothing downstream changes. Entries become removable chips on comma, space (unless
 * `separators="commas"`), Enter or paste; Backspace in an empty draft removes the last chip; each chip is a button
 * "Remove AAPL". The draft being typed is part of the value too (joined last), so an entry not yet committed is never
 * lost on submit.
 */
export function TokenInput({
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
    "aria-label": ariaLabel,
    "aria-required": ariaRequired,
    className,
    id,
    joiner = ", ",
    onChange,
    placeholder,
    separators = "commas-and-spaces",
    value,
}: {
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    "aria-label"?: string;
    "aria-required"?: boolean;
    "className"?: string;
    "id"?: string;
    "joiner"?: string;
    "onChange": (value: string) => void;
    "placeholder"?: string;
    "separators"?: TokenSeparators;
    "value": string;
}) {
    const [draft, setDraft] = React.useState("");

    const inputRef = React.useRef<HTMLInputElement>(null);

    const tokens = splitTokens(value, separators);

    // The draft is the value's last entry while it is being typed; a value changed from outside drops it.
    const trimmed = draft.trim();

    const draftLive = trimmed !== "" && tokens.at(-1) === trimmed;

    const chips = draftLive ? tokens.slice(0, -1) : tokens;

    const shownDraft = draftLive ? draft : "";

    const emit = (committed: ReadonlyArray<string>, nextDraft: string) => {
        setDraft(nextDraft);

        onChange(joinTokens([...committed, nextDraft.trim()], joiner));
    };

    const onText = (text: string) => {
        if (!hasSeparator(text, separators)) {
            emit(chips, text);

            return;
        }

        // A separator typed or pasted: every finished entry becomes a chip, the text after the last separator stays.
        const parts = text.split(SPLIT[separators]);

        const rest = parts.pop() ?? "";

        emit([...chips, ...parts.map(part => part.trim()).filter(Boolean)], rest);
    };

    const remove = (index: number) => {
        emit(chips.filter((_, at) => at !== index), shownDraft);

        inputRef.current?.focus();
    };

    return (
        <div
            className={cn(
                "border-input bg-input/20 dark:bg-input/30 flex min-h-8 w-full min-w-0 cursor-text flex-wrap items-center gap-1 rounded-md border px-1.5 py-1 transition-colors max-sm:min-h-9",
                "has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/30 has-[[data-slot=input-group-control]:focus-visible]:ring-2",
                invalid && "border-destructive ring-destructive/20 dark:ring-destructive/40 ring-2",
                className,
            )}
            data-slot="token-input"
        >
            {chips.map((token, index) => (
                <span className="bg-muted inline-flex h-6 max-w-full items-center gap-0.5 rounded-sm pr-0.5 pl-1.5 text-xs" data-slot="token" key={`${token}-${index}`}>
                    <span className="truncate">{token}</span>
                    <button
                        aria-label={`Remove ${token}`}
                        className="text-muted-foreground hover:text-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-sm max-sm:size-6"
                        onClick={() => remove(index)}
                        type="button"
                    >
                        <XIcon className="size-3" />
                    </button>
                </span>
            ))}
            <input
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                aria-label={ariaLabel}
                aria-required={ariaRequired}
                autoComplete="off"
                className="placeholder:text-muted-foreground h-6 min-w-24 flex-1 bg-transparent px-1 outline-none"
                data-slot="input-group-control"
                id={id}
                onBlur={() => {
                    // Leaving the field commits the draft as a chip (the value already holds it).
                    if (draftLive) setDraft("");
                }}
                onChange={event => onText(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" && trimmed !== "") {
                        event.preventDefault();

                        setDraft("");
                    }
                    else if (event.key === "Backspace" && shownDraft === "" && chips.length > 0) {
                        event.preventDefault();

                        emit(chips.slice(0, -1), "");
                    }
                }}
                placeholder={chips.length === 0 ? placeholder : undefined}
                ref={inputRef}
                spellCheck={false}
                value={shownDraft}
            />
        </div>
    );
}
