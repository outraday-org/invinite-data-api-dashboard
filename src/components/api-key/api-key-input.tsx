import { EyeIcon, EyeOffIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { KeyCheck } from "./use-key-validation";

/** The key field with a show / hide toggle (a key is a secret: hidden by default). */
export function ApiKeyInput({
    id,
    invalid,
    onChange,
    value,
}: {
    id: string;
    invalid?: boolean;
    onChange: (value: string) => void;
    value: string;
}) {
    const [shown, setShown] = React.useState(false);

    return (
        <div className="relative w-full">
            <Input
                aria-invalid={invalid || undefined}
                autoComplete="off"
                className="pr-8"
                id={id}
                onChange={event => onChange(event.target.value)}
                placeholder="invd_..."
                spellCheck={false}
                type={shown ? "text" : "password"}
                value={value}
            />
            <Button
                aria-label={shown ? "Hide key" : "Show key"}
                aria-pressed={shown}
                className="absolute top-1/2 right-0.5 -translate-y-1/2"
                onClick={() => setShown(current => !current)}
                size="icon-sm"
                type="button"
                variant="ghost"
            >
                {shown ? <EyeOffIcon /> : <EyeIcon />}
            </Button>
        </div>
    );
}

/** The result line of a save: "Checking the key…", the refusal (destructive) or "Key valid · PRO plan · N credits". */
export function KeyCheckMessage({ check, className }: { check: KeyCheck; className?: string }) {
    if (check.kind === "idle") return null;

    if (check.kind === "checking") return <p className={cn("text-muted-foreground", className)}>Checking the key…</p>;

    return (
        <p
            className={cn(check.kind === "invalid" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400", className)}
            data-testid="key-check"
            role={check.kind === "invalid" ? "alert" : "status"}
        >
            {check.message}
        </p>
    );
}
