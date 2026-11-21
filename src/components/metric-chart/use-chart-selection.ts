import * as React from "react";

/**
 * `?chart=<row key>` of a page that deep-links its metric chart (the Financials route provides it); without a
 * provider the chart is local state (a table rendered alone, tests).
 */
export const ChartParamContext = React.createContext<null | { chart: null | string; setChart: (key: null | string) => void }>(null);

/**
 * The charted row of a statement / metrics / segments table: the row whose key is the page's `?chart=` (or the local
 * pick), and the setter the row's chart button and the dialog's close call. A key no loaded row has charts nothing.
 */
export function useChartSelection<TRow>(rows: ReadonlyArray<TRow>, keyOf: (row: TRow) => string): [null | TRow, (row: null | TRow) => void] {
    const param = React.useContext(ChartParamContext);

    const [localKey, setLocalKey] = React.useState<null | string>(null);

    const key = param ? param.chart : localKey;

    const selected = key === null ? null : rows.find(row => keyOf(row) === key) ?? null;

    const select = (row: null | TRow) => {
        const next = row === null ? null : keyOf(row);

        if (param) param.setChart(next);
        else setLocalKey(next);
    };

    return [selected, select];
}
