/**
 * The live price line of one call, as a PURE reducer, kept next to the transcript reducer and
 * fed by `use-live-transcript.ts` from the `/v1/ws` `price_tick` frames (`toPriceTick` in
 * `ws-frames.ts`). Prices are only for the chart: nothing here touches the transcript.
 *
 * - Ticks are ordered by `at` (the bar's second). The API sends ≤ 1 per second and only for
 *   seconds with a trade, so a missing second is a gap, never a zero.
 * - A second seen again (a re-subscribe, a snapshot then a stream bar) replaces its tick.
 * - At most `MAX_LIVE_PRICE_TICKS` (two hours of seconds) are held; the oldest go first.
 * - `reference` / `prevClose` keep the newest non-null value: a snapshot tick may lack one.
 */

/** Two hours of one-second ticks. */
export const MAX_LIVE_PRICE_TICKS = 7_200;

/** One `price_tick` frame in camelCase (`toPriceTick`). */
export type LivePriceTick = {
    /** Start of the one-second bar (ISO 8601 UTC). */
    readonly at: string;
    /** The bar start on the transcript clock; null before the call's clock is known. */
    readonly callMs: null | number;
    readonly price: number;
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly volume: number;
    readonly cumulativeVolume: null | number;
    readonly referencePrice: null | number;
    readonly returnBps: null | number;
    readonly prevClose: null | number;
    readonly dayReturnBps: null | number;
    readonly source: "snapshot" | "stream";
};

export type LivePricesState = {
    /** Ascending by `at`, one per second, ≤ `MAX_LIVE_PRICE_TICKS`. */
    readonly ticks: ReadonlyArray<LivePriceTick>;
    /** The newest tick by `at` (`null` = none yet). */
    readonly last: LivePriceTick | null;
    /** The call's reference price (the newest non-null `referencePrice`). */
    readonly reference: null | number;
    /** The previous session's close (the newest non-null `prevClose`). */
    readonly prevClose: null | number;
};

export type LivePricesAction = { kind: "tick"; tick: LivePriceTick };

export const INITIAL_LIVE_PRICES: LivePricesState = {
    last: null,
    prevClose: null,
    reference: null,
    ticks: [],
};

export function livePricesReducer(state: LivePricesState, action: LivePricesAction): LivePricesState {
    const { tick } = action;

    const atMs = Date.parse(tick.at);

    if (Number.isNaN(atMs)) return state;

    const ticks = [...state.ticks];

    // Ticks arrive in order; walk back from the end for the insert position.
    let index = ticks.length;

    while (index > 0 && Date.parse(ticks[index - 1].at) > atMs) index -= 1;

    if (index > 0 && Date.parse(ticks[index - 1].at) === atMs) ticks[index - 1] = tick;
    else ticks.splice(index, 0, tick);

    const capped = ticks.length > MAX_LIVE_PRICE_TICKS ? ticks.slice(ticks.length - MAX_LIVE_PRICE_TICKS) : ticks;

    return {
        last: capped.at(-1) ?? null,
        prevClose: tick.prevClose ?? state.prevClose,
        reference: tick.referencePrice ?? state.reference,
        ticks: capped,
    };
}
