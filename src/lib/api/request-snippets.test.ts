import { describe, expect, it } from "vitest";

import type { RequestMeta } from "./request-meta";

import { hasSnippet, pythonLiteral, pythonOf, snippetOf, typescriptOf } from "./request-snippets";

const BASE = "https://api.test";

const meta = (patch: Partial<RequestMeta> = {}): RequestMeta => ({
    credits: 1,
    method: "GET",
    operationId: "listDividends",
    path: "/v1/dividends",
    query: { "ex_date.gte": "2026-01-01", "limit": "50", "symbol": "AAPL" },
    requestId: "req_1",
    status: 200,
    ...patch,
});

const fund = meta({ operationId: "getFund", path: "/v1/funds/SPY", query: {} });

const createAlert = meta({
    body: { condition: { symbols: ["AAPL"] }, enabled: true, note: null, type: "price" },
    method: "POST",
    operationId: "createAlert",
    path: "/v1/alerts",
    query: { validate_only: "true" },
});

describe("pythonOf", () => {
    it("one call: the SDK class and snake_case method, typed values, the key from the environment", () => {
        expect(pythonOf(BASE, [meta()])).toBe([
            "import os",
            "from datetime import date",
            "",
            "from invinite_data_api import ApiClient, Configuration, CorporateActionsApi",
            "",
            "configuration = Configuration(",
            "    host=\"https://api.test\",",
            "    access_token=os.environ[\"INVINITE_API_KEY\"],",
            ")",
            "",
            "with ApiClient(configuration) as client:",
            "    response = CorporateActionsApi(client).list_dividends(",
            "        ex_date_gte=date.fromisoformat(\"2026-01-01\"),",
            "        limit=50,",
            "        symbol=\"AAPL\",",
            "    )",
            "    print(response)",
        ].join("\n"));
    });

    it("a path parameter and a body (the model's from_dict, Python literals)", () => {
        const code = pythonOf(BASE, [fund, createAlert]);

        expect(code).toContain("from invinite_data_api import AlertsApi, ApiClient, Configuration, CreateAlertRequest, FundsApi");

        expect(code).toContain("FundsApi(client).get_fund(\n        fund=\"SPY\",\n    )");

        expect(code).toContain("validate_only=True,");

        expect(code).toContain("create_alert_request=CreateAlertRequest.from_dict({");

        expect(code).toContain("\"enabled\": True,");

        expect(code).toContain("\"note\": None,");
    });

    it("writes JSON as Python literals", () => {
        expect(pythonLiteral({ a: [1, false], b: null })).toBe("{\n    \"a\": [\n        1,\n        False,\n    ],\n    \"b\": None,\n}");
    });
});

describe("typescriptOf", () => {
    it("one call: camelCase request fields, dates as Date, numbers as numbers", () => {
        expect(typescriptOf(BASE, [meta()])).toBe([
            "import { Configuration, CorporateActionsApi } from \"@invinite-org/data-api-client\";",
            "",
            "const configuration = new Configuration({",
            "    accessToken: process.env.INVINITE_API_KEY,",
            "    basePath: \"https://api.test\",",
            "});",
            "",
            "const response = await new CorporateActionsApi(configuration).listDividends({",
            "    exDateGte: new Date(\"2026-01-01\"),",
            "    limit: 50,",
            "    symbol: \"AAPL\",",
            "});",
            "",
            "console.log(response);",
        ].join("\n"));
    });

    it("several calls number their answers; a body goes through the model's FromJSON", () => {
        const code = typescriptOf(BASE, [fund, createAlert]);

        expect(code).toContain("import { AlertsApi, Configuration, CreateAlertRequestFromJSON, FundsApi }");

        expect(code).toContain("const response1 = await new FundsApi(configuration).getFund({\n    fund: \"SPY\",\n});");

        expect(code).toContain("createAlertRequest: CreateAlertRequestFromJSON({");

        expect(code).toContain("validateOnly: true,");
    });
});

describe("snippetOf", () => {
    it("reads the key from the environment, never a value (the CLI reads it itself)", () => {
        for (const format of ["curl", "python", "typescript"] as const) {
            expect(snippetOf(format, BASE, [meta()])).toMatch(/INVINITE_API_KEY/);
        }
    });

    it("names the published SDK operations for an exact as-reported period", () => {
        const request = meta({
            operationId: "getAsReportedFinancialsDetailed",
            path: "/v1/financials/as-reported/detailed",
            query: { company: "AAPL", fiscal_quarter: "3", fiscal_year: "2026", limit: "1", period: "quarterly" },
        });

        expect(pythonOf(BASE, [request])).toContain("FinancialsApi(client).get_as_reported_financials_detailed(");

        expect(typescriptOf(BASE, [request])).toContain("new FinancialsApi(configuration).getAsReportedFinancialsDetailed({");

        expect(pythonOf(BASE, [request])).toContain("fiscal_quarter=3");

        expect(typescriptOf(BASE, [request])).toContain("fiscalQuarter: 3");
    });

    it("an operation outside the SDK / CLI is a comment", () => {
        const status = meta({ operationId: "statusGet", path: "/status", query: {} });

        expect(hasSnippet(status, "python")).toBe(false);

        expect(pythonOf(BASE, [status])).toContain("# GET /status: not in the SDK");

        expect(typescriptOf(BASE, [status])).toContain("// GET /status: not in the SDK");
    });
});
