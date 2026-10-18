import { describe, expect, it } from "vitest";

import { dataApiDashboardUrl, docsUrl, INVINITE_APP_URL } from "./app-url";

describe("dataApiDashboardUrl", () => {
    it("points at the data app, never the API host or the web product", () => {
        expect(INVINITE_APP_URL).toBe("https://data.invinite.com");
        expect(dataApiDashboardUrl()).toBe("https://data.invinite.com");
        expect(dataApiDashboardUrl("keys")).toBe("https://data.invinite.com/keys");
        expect(docsUrl()).toBe("https://data.invinite.com/docs");
    });
});
