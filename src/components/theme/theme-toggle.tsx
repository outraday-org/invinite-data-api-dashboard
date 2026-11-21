import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import type { Theme } from "@/lib/theme";

import { Button } from "@/components/ui/button";
import { nextTheme, useTheme } from "@/lib/theme";

const LABELS: Record<Theme, string> = { dark: "Dark theme", light: "Light theme", system: "System theme" };

const ICONS = { dark: MoonIcon, light: SunIcon, system: MonitorIcon } satisfies Record<Theme, unknown>;

/** The top bar's theme switch: system → light → dark, stored per browser (no flash on reload: `THEME_SCRIPT`). */
export function ThemeToggle() {
    const [theme, setTheme] = useTheme();

    const Icon = ICONS[theme];

    const next = nextTheme(theme);

    return (
        <Button
            aria-label={`${LABELS[theme]} (switch to ${LABELS[next].toLowerCase()})`}
            onClick={() => setTheme(next)}
            size="icon-lg"
            title={LABELS[theme]}
            type="button"
            variant="ghost"
        >
            <Icon />
        </Button>
    );
}
