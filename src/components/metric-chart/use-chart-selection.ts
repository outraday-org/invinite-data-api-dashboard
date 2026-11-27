import * as React from "react";

/**
 * `?chart=<row key>` of a page that deep-links its metric chart (the Financials route provides it); without a
 * provider the chart is local state (a table rendered alone, tests).
 */
export const ChartParamContext = React.createContext<null | { chart: null | string; setChart: (key: null | string) => void }>(null);

/**
 * The charted row of a statement / metrics / segments table: the row whose key is the page's `?chart=` (or the local
 * pick), and the setter the row's chart button and the dialog's close call. Accept a legacy key only when it
 * identifies a single loaded row. The setter always uses the current key.
 */
export function useChartSelection<TRow>(
    rows: ReadonlyArray<TRow>,
    keyOf: (row: TRow) => string,
    legacyKeyOf?: (row: TRow) => string | undefined,
): [null | TRow, (row: null | TRow) => void] {
    const param = React.useContext(ChartParamContext);

    const [localKey, setLocalKey] = React.useState<null | string>(null);

    const key = param ? param.chart : localKey;

    let selected = key === null ? null : rows.find(row => keyOf(row) === key) ?? null;

    if (selected === null && key !== null && legacyKeyOf) {
        const matches = rows.filter(row => legacyKeyOf(row) === key);

        if (matches.length === 1) selected = matches[0] ?? null;
    }

    const select = (row: null | TRow) => {
        const next = row === null ? null : keyOf(row);

        if (param) param.setChart(next);
        else setLocalKey(next);
    };

    return [selected, select];
}
