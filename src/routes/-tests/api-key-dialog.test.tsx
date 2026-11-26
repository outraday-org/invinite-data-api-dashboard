// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyDialogButton } from "@/components/api-key/api-key-dialog";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));

vi.mock("@/lib/api/queries", () => ({ useKeyState: () => ({ me: null }) }));

vi.mock("@/components/api-key/use-key-validation", () => ({ useKeyValidation: () => ({ check: { kind: "idle" }, reset: () => {}, save: () => Promise.resolve(false) }) }));

vi.mock("@/components/api-key/api-key-input", () => ({ ApiKeyInput: () => <input aria-label="API key" />, KeyCheckMessage: () => null }));

vi.mock("@/components/api-key/no-key-yet", () => ({ NoKeyYetHint: () => null }));

afterEach(() => {
    cleanup();
});

describe("API key dialog opens by itself without a stored key", () => {
    it("opens once the store has read localStorage and holds no key", async () => {
        useApiKeyStore.setState({ apiKey: null, hasHydrated: true });

        render(<ApiKeyDialogButton />);

        expect(await screen.findByRole("dialog")).toBeTruthy();
    });

    it("stays closed with a stored key", () => {
        useApiKeyStore.setState({ apiKey: "inv_test_key", hasHydrated: true });

        render(<ApiKeyDialogButton />);

        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("waits for hydration: nothing opens before localStorage was read", () => {
        useApiKeyStore.setState({ apiKey: null, hasHydrated: false });

        render(<ApiKeyDialogButton />);

        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
