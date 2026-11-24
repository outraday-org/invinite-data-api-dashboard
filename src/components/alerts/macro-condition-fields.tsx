import type { AlertFormState, FieldErrors } from "@/lib/alerts/alert-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { familyLabels, isMacroSeries, MACRO_EVENTS, MACRO_FAMILIES, MACRO_METRIC_LABELS, MACRO_OPERATOR_LABELS, readMacroThreshold, thresholdFields } from "@/lib/alerts/macro-condition";
import { MACRO_ALERT_SERIES } from "@/lib/api/operations.gen";

type Condition = AlertFormState["condition"];

const ids = Object.keys(MACRO_ALERT_SERIES).filter(isMacroSeries);

const choices = (value: unknown): Array<string> => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const toggle = (items: Array<string>, id: string) => items.includes(id) ? items.filter(v => v !== id) : [...items, id];

const selectStyle = "rounded-md border border-input bg-background px-2 py-1 text-sm";

export function MacroConditionFields({ condition, errors, onChange}: { condition: Condition; onChange: (value: Condition) => void; errors: FieldErrors }) {
    const events = choices(condition.macro_events), families = choices(condition.macro_families), selected = choices(condition.macro_series_ids);

    const admitted = ids.filter(id => !families.length || families.includes(MACRO_ALERT_SERIES[id].family));

    const threshold = readMacroThreshold(condition.macro_threshold);

    const candidates = admitted.filter(id => !selected.length || selected.includes(id));

    const setThreshold = (value: typeof threshold) => onChange({ ...condition, macro_threshold: value ? JSON.stringify(value) : undefined });

    const changeScope = (nextFamilies: Array<string>, nextIds: Array<string>) => {
        const allowed = ids.filter(id => !nextFamilies.length || nextFamilies.includes(MACRO_ALERT_SERIES[id].family));

        const scoped = nextIds.filter(isMacroSeries).filter(id => allowed.includes(id));

        const eligible = allowed.filter(id => !scoped.length || scoped.includes(id));

        const replacement = eligible.at(0);

        const next = threshold && !eligible.includes(threshold.series_id) ? (replacement ? { field: "value", operator: threshold.operator, series_id: replacement, value: "" } : null) : threshold;

        onChange({ ...condition, macro_families: nextFamilies, macro_series_ids: scoped, macro_threshold: next ? JSON.stringify(next) : undefined });
    };

    return (
        <div className="col-span-full grid gap-4 sm:grid-cols-2">
            <fieldset className="space-y-1">
                <legend className="font-medium">Publication events</legend>
                {MACRO_EVENTS.map(kind => (
                    <label className="flex items-center gap-2" key={kind}>
                        <input checked={events.includes(kind)} onChange={() => onChange({ ...condition, macro_events: toggle(events, kind) })} type="checkbox" />
                        {kind === "macro.released" ? "Releases" : "Revisions"}
                    </label>
                ))}
            </fieldset>
            <fieldset className="space-y-1">
                <legend className="font-medium">Macro families</legend>
                {MACRO_FAMILIES.map(f => (
                    <label className="flex items-center gap-2" key={f}>
                        <input checked={families.includes(f)} onChange={() => changeScope(toggle(families, f), selected)} type="checkbox" />
                        {familyLabels[f]}
                    </label>
                ))}
            </fieldset>
            <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="font-medium">Series and tenors</span>
                <select className={selectStyle} multiple onChange={e => changeScope(families, Array.from(e.currentTarget.selectedOptions, opt => opt.value))} size={5} value={selected}>
                    {admitted.map(id => (
                        <option key={id} value={id}>
                            {MACRO_ALERT_SERIES[id].label}
                            {" "}
                            (
                            {id}
                            )
                        </option>
                    ))}
                </select>
                <span className="text-muted-foreground">Leave the selection empty to include all series in the chosen families.</span>
            </label>
            {threshold
                ? (
                        <fieldset className="col-span-full grid gap-2 sm:grid-cols-2">
                            <legend className="font-medium">Numeric threshold</legend>
                            <label className="grid gap-1">
                                Threshold series
                                <select className={selectStyle} onChange={(e) => { if (isMacroSeries(e.target.value))setThreshold({ ...threshold, field: "value", series_id: e.target.value, value: "" }); }} value={threshold.series_id}>
                                    {candidates.map(id => (
                                        <option key={id} value={id}>
                                            {MACRO_ALERT_SERIES[id].label}
                                            {" "}
                                            (
                                            {id}
                                            )
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="grid gap-1">
                                Threshold field
                                <select className={selectStyle} onChange={e => setThreshold({ ...threshold, field: e.target.value, value: "" })} value={threshold.field}>
                                    {Object.entries(thresholdFields(threshold.series_id)).map(([field, unit]) => (
                                        <option key={field} value={field}>
                                            {MACRO_METRIC_LABELS[field]}
                                            {" "}
                                            (
                                            {unit}
                                            )
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="grid gap-1">
                                Comparison
                                <select className={selectStyle} onChange={e => setThreshold({ ...threshold, operator: e.target.value })} value={threshold.operator}>
                                    {Object.entries(MACRO_OPERATOR_LABELS).map(([operator, label]) => <option key={operator} value={operator}>{label}</option>)}
                                </select>
                            </label>
                            <label className="grid gap-1">
                                Threshold value (
                                {thresholdFields(threshold.series_id)[threshold.field]}
                                )
                                <Input inputMode="decimal" onChange={e => setThreshold({ ...threshold, value: e.target.value })} value={threshold.value} />
                            </label>
                            <Button onClick={() => setThreshold(null)} size="sm" type="button" variant="outline">Remove threshold</Button>
                        </fieldset>
                    )
                : (
                        <Button
                            className="w-fit"
                            onClick={() => {
                                const id = candidates.at(0);

                                if (id) setThreshold({ field: "value", operator: "gt", series_id: id, value: "" });
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            Add numeric threshold
                        </Button>
                    )}
            {Object.entries(errors).filter(([name]) => name.startsWith("condition.macro_")).map(([name, message]) => <p className="text-destructive" key={name} role="alert">{message}</p>)}
        </div>
    );
}
