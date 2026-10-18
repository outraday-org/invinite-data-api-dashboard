import { describe, expect, it } from "vitest";

import { dataApiDashboardUrl, INVINITE_APP_URL } from "./app-url";

describe("dataApiDashboardUrl", () => {
    it("points at the app's dashboard, never the API host", () => {
        expect(INVINITE_APP_URL).toBe("https://invinite.com");
        expect(dataApiDashboardUrl()).toBe("https://invinite.com/data-api");
        expect(dataApiDashboardUrl("keys")).toBe("https://invinite.com/data-api/keys");
    });
});
