import * as React from "react";

/** A set of selected ids with one setter for one or many (`ids`, on / off). */
export function useIdSelection(): [ReadonlySet<string>, (ids: ReadonlyArray<string>, on: boolean) => void] {
    const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());

    const update = React.useCallback((ids: ReadonlyArray<string>, on: boolean) => setSelected((current) => {
        const next = new Set(current);

        for (const id of ids) {
            if (on) next.add(id);
            else next.delete(id);
        }

        return next;
    }), []);

    return [selected, update];
}
