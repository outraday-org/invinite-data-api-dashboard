import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { V2Fund } from "@/lib/api/types";

import { FUND_STRUCTURE_LABELS, INSTRUMENT_TYPE_LABELS, SECTION_DATASETS, sectionDatasets } from "@/lib/instruments";
import {
    FUND_REASON_TEXT,
    FUND_SOURCE_LABELS,
    fundBasisNote,
    fundPickerDays,
    fundReasonText,
    fundSourceText,
    fundWeightsByDimension,
    HOLDER_SECTION_STATE_LABELS,
    HOLDER_SOURCE_LABELS,
    netAssetsScopeText,
} from "@/lib/sec/fund";
import { V2_FUND_POSITIONS, V2_FUND_WEIGHTS } from "@/lib/sec/v2-fixtures";

describe("fund composition helpers (Data API 7.0)", () => {
    it("labels a composition by source and as-of date, never 'current'", () => {
        expect(fundSourceText("issuer_daily", "2026-11-13")).toBe("Issuer file · as of Nov 13, 2026");

        expect(fundSourceText("issuer_monthly", "2026-10-31")).toBe("Issuer file (monthly) · as of Oct 31, 2026");

        expect(fundSourceText("nport", "2026-09-30")).toBe("SEC N-PORT filing · as of Sep 30, 2026");

        expect(fundSourceText(null, "2026-09-30")).toBeNull();
    });

    it("the picker offers the served days only (ready issuer files, N-PORT reports), newest first", () => {
        expect(fundPickerDays(V2_FUND_POSITIONS.meta.composition?.stored_dates)).toEqual([
            { label: "2026-11-13 · Issuer file", value: "2026-11-13" },
            { label: "2026-11-11 · Issuer file", value: "2026-11-11" },
            { label: "2026-09-30 · SEC N-PORT filing", value: "2026-09-30" },
        ]);

        expect(fundPickerDays(null)).toEqual([]);
    });

    it("groups the weights per dimension, largest first, and names their basis", () => {
        const groups = fundWeightsByDimension(V2_FUND_WEIGHTS.data);

        expect(groups.map(group => group.dimension)).toEqual(["sector", "country"]);

        expect(groups[0]?.weights.map(weight => weight.bucket)).toEqual(["Information Technology", "Financials"]);

        expect(fundBasisNote(groups[1]?.weights ?? [])).toBe("partly derived, not classified");

        expect(fundReasonText("single_asset_trust")).toBe("This fund holds one asset; there is no holdings list.");

        expect(fundReasonText(null)).toBeNull();
    });
});

type Schema = { enum?: Array<string>; items?: Schema; properties?: Partial<Record<string, Schema>> };

type Spec = {
    components: { schemas: Partial<Record<string, Schema>> };
    paths: Partial<Record<string, { get: { responses: { 200: { content: { "application/json": { schema: Schema } } } } } }>>;
};

// The pinned contract itself (not the generated types): a value added to `openapi.json` fails here until it is labelled.
const spec = JSON.parse(readFileSync(new URL("../../../openapi.json", import.meta.url), "utf8")) as Spec;

const schema = (name: string): Schema => spec.components.schemas[name] ?? {};

const metaOf = (path: string): Schema => spec.paths[path]?.get.responses[200].content["application/json"].schema.properties?.meta ?? {};

const enumOf = (node: Schema | undefined): Array<string> => {
    const values = node?.enum ?? [];

    expect(values.length).toBeGreaterThan(0);

    return values;
};

describe("every contract enum value has its label", () => {
    it("instrument types and fund structures", () => {
        expect(Object.keys(INSTRUMENT_TYPE_LABELS).sort()).toEqual(enumOf(schema("Instrument").properties?.type).sort());

        expect(Object.keys(FUND_STRUCTURE_LABELS).sort()).toEqual(enumOf(schema("Instrument").properties?.structure).sort());

        expect(enumOf(schema("Fund").properties?.net_assets_scope).map(scope => netAssetsScopeText(scope as V2Fund["net_assets_scope"]))).not.toContain(null);
    });

    it("composition sources and reasons (holdings + weights)", () => {
        expect(Object.keys(FUND_SOURCE_LABELS).sort()).toEqual(enumOf(schema("FundPosition").properties?.source).sort());

        const reasons = new Set([
            ...enumOf(metaOf("/v1/funds/{fund}/holdings").properties?.reason),
            ...enumOf(metaOf("/v1/funds/{fund}/weights").properties?.reason),
        ]);

        expect(Object.keys(FUND_REASON_TEXT).sort()).toEqual([...reasons].sort());
    });

    it("holder sources and overview section states", () => {
        expect(Object.keys(HOLDER_SOURCE_LABELS).sort()).toEqual(enumOf(schema("Holder").properties?.source).sort());

        const section = metaOf("/v1/holders").properties?.sections?.items;

        expect(Object.keys(HOLDER_SECTION_STATE_LABELS).sort()).toEqual(enumOf(section?.properties?.state).sort());
    });

    it("every dataset a section shows is a contract dataset", () => {
        const datasets = enumOf(schema("Instrument").properties?.datasets?.items);

        for (const section of Object.keys(SECTION_DATASETS)) {
            for (const dataset of sectionDatasets(section)) expect(datasets).toContain(dataset);
        }
    });
});
