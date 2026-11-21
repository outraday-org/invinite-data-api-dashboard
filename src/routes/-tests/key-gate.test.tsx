// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KeyGate } from "@/components/api-key/key-gate";
import { keyErrorText } from "@/components/api-key/use-key-validation";
import { keyValidText } from "@/lib/account";
import { ME_PRO } from "@/lib/account-fixtures";
import { ApiRequestError } from "@/lib/api/errors";
import { useKeyState } from "@/lib/api/queries";
import { getMe } from "@/lib/api/server-functions";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

vi.mock("@/lib/api/queries", () => ({ useKeyState: vi.fn() }));

vi.mock("@/lib/api/server-functions", () => ({ getMe: vi.fn() }));

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const unauthorized = new ApiRequestError(401, { error: "missing_api_key", message: "No API key is set." });

afterEach(cleanup);

beforeEach(() => {
    vi.clearAllMocks();

    useApiKeyStore.setState({ apiKey: null, hasHydrated: true });
});

const gate = () => render(<KeyGate><div data-testid="page">page</div></KeyGate>);

describe("key gate (`/v1/me`)", () => {
    it("no key or a refused key: the onboarding card instead of the page", () => {
        vi.mocked(useKeyState).mockReturnValue({ me: null, state: "invalid" });

        gate();

        expect(screen.queryByTestId("page")).toBeNull();

        expect(screen.getByTestId("onboarding-card")).toBeInTheDocument();

        expect(screen.getByText("Enter your API key")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: /create one/i })).toBeInTheDocument();
    });

    it("a stored key the API refused says so", () => {
        useApiKeyStore.setState({ apiKey: "invd_old", hasHydrated: true });

        vi.mocked(useKeyState).mockReturnValue({ me: null, state: "invalid" });

        gate();

        expect(screen.getByText("Your API key was refused")).toBeInTheDocument();
    });

    it("renders nothing of the page while `/v1/me` is checked; the page once the key answered (or `/v1/me` failed otherwise)", () => {
        vi.mocked(useKeyState).mockReturnValue({ me: null, state: "checking" });

        const { rerender } = gate();

        expect(screen.queryByTestId("page")).toBeNull();

        expect(screen.getByTestId("key-gate-checking")).toBeInTheDocument();

        vi.mocked(useKeyState).mockReturnValue({ me: ME_PRO, state: "ready" });

        rerender(<KeyGate><div data-testid="page">page</div></KeyGate>);

        expect(screen.getByTestId("page")).toBeInTheDocument();

        vi.mocked(useKeyState).mockReturnValue({ me: null, state: "unavailable" });

        rerender(<KeyGate><div data-testid="page">page</div></KeyGate>);

        expect(screen.getByTestId("page")).toBeInTheDocument();
    });

    it("saving validates the key: refused → inline error and the old key stays; valid → stored with its plan", async () => {
        useApiKeyStore.setState({ apiKey: "invd_old", hasHydrated: true });

        vi.mocked(useKeyState).mockReturnValue({ me: null, state: "invalid" });

        vi.mocked(getMe).mockRejectedValueOnce(unauthorized);

        gate();

        fireEvent.change(screen.getByLabelText(/API Key/), { target: { value: "invd_wrong" } });

        await act(() => {
            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            return Promise.resolve();
        });

        expect(getMe).toHaveBeenLastCalledWith({ data: { apiKey: "invd_wrong" } });

        expect(screen.getByRole("alert")).toHaveTextContent("This key was refused");

        expect(useApiKeyStore.getState().apiKey).toBe("invd_old");

        vi.mocked(getMe).mockResolvedValueOnce(ME_PRO as never);

        fireEvent.change(screen.getByLabelText(/API Key/), { target: { value: "invd_good" } });

        await act(() => {
            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            return Promise.resolve();
        });

        expect(useApiKeyStore.getState().apiKey).toBe("invd_good");

        expect(screen.getByRole("status")).toHaveTextContent("Key valid · PRO plan · 3,728,983 credits");
    });

    it("the key field hides the key until shown", () => {
        vi.mocked(useKeyState).mockReturnValue({ me: null, state: "invalid" });

        gate();

        const input = screen.getByLabelText(/API Key/);

        expect(input).toHaveAttribute("type", "password");

        fireEvent.click(screen.getByRole("button", { name: "Show key" }));

        expect(input).toHaveAttribute("type", "text");
    });
});

describe("key messages", () => {
    it("names the plan and the remaining credits", () => {
        expect(keyValidText(ME_PRO)).toBe("Key valid · PRO plan · 3,728,983 credits");
    });

    it("a refusal vs a failed check", () => {
        expect(keyErrorText(unauthorized)).toMatch(/refused/);

        expect(keyErrorText(new Error("fetch failed"))).toBe("The key could not be checked (fetch failed); your previous key is kept.");
    });
});
