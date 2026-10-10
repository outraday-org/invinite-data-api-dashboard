import { describe, expect, it } from "vitest";

import { validateStatusSearch } from "./search";

describe("validateStatusSearch", () => {
    it("accepts the three windows and defaults to 30 days", () => {
        expect(validateStatusSearch({ days: 7 })).toEqual({ days: 7, vendor: undefined });

        expect(validateStatusSearch({ days: "90" })).toEqual({ days: 90, vendor: undefined });

        expect(validateStatusSearch({ days: 14 })).toEqual({ days: 30, vendor: undefined });

        expect(validateStatusSearch({})).toEqual({ days: 30, vendor: undefined });
    });

    it("keeps a vendor and drops the default `all`", () => {
        expect(validateStatusSearch({ vendor: " notified " })).toEqual({ days: 30, vendor: "notified" });

        expect(validateStatusSearch({ vendor: "all" })).toEqual({ days: 30, vendor: undefined });

        expect(validateStatusSearch({ vendor: 3 })).toEqual({ days: 30, vendor: undefined });
    });

    it("drops a vendor IDA would reject", () => {
        expect(validateStatusSearch({ vendor: "Notified" })).toEqual({ days: 30, vendor: undefined });

        expect(validateStatusSearch({ vendor: "a".repeat(25) })).toEqual({ days: 30, vendor: undefined });

        expect(validateStatusSearch({ vendor: "../x" })).toEqual({ days: 30, vendor: undefined });

        expect(validateStatusSearch({ vendor: "q4events" })).toEqual({ days: 30, vendor: "q4events" });
    });
});
