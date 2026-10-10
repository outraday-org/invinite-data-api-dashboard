import { turnIndexAt } from "./transcript";

const POLL_MS = 150;

const HIGHLIGHT_MS = 2000;

const HIGHLIGHT_CLASSES = ["ring-2", "ring-primary/40", "rounded-md"];

/**
 * Scrolls the transcript turn containing `ms` into view and flashes it. The Transcript tab
 * renders its turns with `data-start-ms` after it mounts and loads, so this polls for them
 * (up to `timeoutMs`); returns false when no timed turn appeared (another format, untimed text).
 */
export function scrollToTurn(ms: number, timeoutMs = 10_000): Promise<boolean> {
    const startedAt = Date.now();

    return new Promise((resolve) => {
        const attempt = () => {
            const turns = [...document.querySelectorAll<HTMLElement>("[data-start-ms]")];

            if (turns.length === 0) {
                if (Date.now() - startedAt < timeoutMs) setTimeout(attempt, POLL_MS);
                else resolve(false);

                return;
            }

            const turn = turns[turnIndexAt(turns.map(element => Number(element.dataset.startMs)), ms)];

            turn.scrollIntoView({ behavior: "smooth", block: "center" });

            turn.classList.add(...HIGHLIGHT_CLASSES);

            setTimeout(() => turn.classList.remove(...HIGHLIGHT_CLASSES), HIGHLIGHT_MS);

            resolve(true);
        };

        attempt();
    });
}
