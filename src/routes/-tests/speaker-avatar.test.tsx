// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SpeakerAvatar } from "@/components/earnings/speaker-avatar";

afterEach(cleanup);

const URL = "https://storage.invinite.com/people/jensen-huang.webp";

describe("SpeakerAvatar", () => {
    it("shows the image, round", () => {
        const { container } = render(<SpeakerAvatar imageUrl={URL} name="Jensen Huang" />);

        const img = container.querySelector("img");

        expect(img?.getAttribute("src")).toBe(URL);

        expect(img?.className).toContain("rounded-full");
    });

    it("falls back to initials without an image or when it fails", () => {
        const { container, rerender } = render(<SpeakerAvatar imageUrl={null} name="Colette M. Kress" />);

        expect(container.textContent).toBe("CK");

        rerender(<SpeakerAvatar imageUrl={URL} name="Colette M. Kress" />);

        fireEvent.error(container.querySelector("img") as HTMLImageElement);

        expect(container.querySelector("img")).toBeNull();

        expect(container.textContent).toBe("CK");
    });

    it("renders nothing without a name or for the operator", () => {
        expect(render(<SpeakerAvatar imageUrl={URL} name={null} />).container.innerHTML).toBe("");

        expect(render(<SpeakerAvatar imageUrl={null} name="Operator" speakerRole="operator" />).container.innerHTML).toBe("");
    });
});
