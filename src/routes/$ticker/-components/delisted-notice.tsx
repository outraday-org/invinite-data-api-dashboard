import { Link } from "@tanstack/react-router";

import type { V2Instrument } from "@/lib/api/types";

import { Notice } from "@/components/ui/notice";
import { delistedText } from "@/lib/instruments";

/** The delisted Overview links the instrument record and its SEC filer, with the eligible historical families. */
export function DelistedNotice({ instrument, onOverview }: { instrument: Pick<V2Instrument, "company" | "datasets" | "symbol" | "type">; onOverview: boolean }) {
    const cik = instrument.company?.cik;

    const action = (
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {!onOverview && (
                <Link className="underline-offset-4 hover:underline" params={{ ticker: instrument.symbol }} to="/$ticker">
                    The listing
                </Link>
            )}
            {cik && (
                <Link className="underline-offset-4 hover:underline" params={{ cik }} title={`SEC filer · CIK ${cik}`} to="/sec/$cik">
                    SEC filer record
                </Link>
            )}
        </span>
    );

    return (
        <Notice action={!onOverview || cik ? action : undefined} badge="Delisted" title={`${instrument.symbol} is delisted`}>
            {delistedText(instrument)}
        </Notice>
    );
}
