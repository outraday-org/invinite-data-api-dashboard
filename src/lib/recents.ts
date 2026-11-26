import * as React from "react";

import type { V2FilerMatch, V2FilerResponse, V2Instrument } from "@/lib/api/types";
import type { ManagerSignal } from "@/lib/navigation";
import type { RecentSubject } from "@/lib/stores/ticker-store";

import { filerCikParam } from "@/components/sec/security-link";
import { INSTRUMENT_TYPE_LABELS } from "@/lib/instruments";
import { filesThirteenF } from "@/lib/navigation";
import { useTickerStore } from "@/lib/stores/ticker-store";

/** An instrument as a recent subject ("AAPL", "Apple Inc.", "Stock"). */
export function recentInstrument(instrument: Pick<V2Instrument, "name" | "structure" | "symbol" | "type">): RecentSubject {
    const type = INSTRUMENT_TYPE_LABELS[instrument.type];

    return {
        badge: instrument.structure === "exchange_traded_trust" ? `${type} (trust)` : type,
        kind: "instrument",
        label: instrument.symbol,
        name: instrument.name,
        ref: instrument.symbol,
    };
}

/** A filer as a recent subject (its name; "Institution" for a 13F manager). */
export function recentFiler(filer: ManagerSignal & Pick<V2FilerMatch | V2FilerResponse, "cik" | "name" | "phase">): RecentSubject {
    const cik = filerCikParam(filer.cik) ?? filer.cik;

    return { badge: filesThirteenF(filer) ? "Institution" : "SEC filer", kind: "filer", label: filer.name || `CIK ${cik}`, name: `CIK ${cik}`, ref: cik };
}

/** Puts the open page's subject on top of the recents once it has loaded (null = nothing yet). */
export function useRecordRecent(subject: null | RecentSubject) {
    const addRecent = useTickerStore(state => state.addRecent);

    // One write per subject: the effect keys on its fields (the object is rebuilt on every render).
    const { badge = null, kind = null, label = "", name = null, ref = "" } = subject ?? {};

    React.useEffect(() => {
        if (kind) addRecent({ badge, kind, label, name, ref });
    }, [addRecent, badge, kind, label, name, ref]);
}
