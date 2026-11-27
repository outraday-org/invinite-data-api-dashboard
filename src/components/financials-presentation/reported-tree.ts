import type { V2AsReportedPresentationNode } from "@/lib/api/types";

import { dimensionsText } from "@/lib/financials/statements";

import type { PresentationPeriod, TreeRow } from "./types";

import { asReportedNodeKey as keyOf } from "./utils";

type Node = V2AsReportedPresentationNode;

type Line = {
    cells: Map<number, Node>;
    node: Node;
};

/** A line and its optional member wrapper occupy the same place across versions. */
type Place = {
    children: Map<string, Place>;
    header?: Node;
    line?: Line;
    members: Map<string, Line>;
    order: Array<null | string>;
};

const isGroup = (node: Node) => keyOf(node) === `${node.concept}#group`;

function partsOf(node: Node) {
    const group = isGroup(node);

    const key = group ? node.concept : keyOf(node);

    const line = group ? node.children?.find(child => keyOf(child) === key) : node;

    const children = (group && !line ? node.children : line?.children) ?? [];

    const members = (group ? node.children : line?.children)?.filter(child => child.dimensions?.length) ?? [];

    return { children: children.filter(child => !child.dimensions?.length), group, key, line, members };
}

function countPlacements(nodes: ReadonlyArray<Node>, counts: Map<string, number>) {
    for (const node of nodes) {
        const { children, key } = partsOf(node);

        counts.set(key, (counts.get(key) ?? 0) + 1);

        countPlacements(children, counts);
    }
}

function addPeriod(
    places: Map<string, Place>,
    nodes: ReadonlyArray<Node>,
    column: number,
    seed: boolean,
    counts: ReadonlyMap<string, number>,
    uniquePlaces: Map<string, null | Place>,
    exactPath = true,
    canAdd = true,
) {
    const occurrences = new Map<string, number>();

    for (const node of nodes) {
        const { children, group, key, line, members } = partsOf(node);

        const index = occurrences.get(key) ?? 0;

        occurrences.set(key, index + 1);

        const id = JSON.stringify([key, index]);

        const exact = exactPath ? places.get(id) : undefined;

        const unique = counts.get(key) === 1;

        const matched = exact ?? (unique ? uniquePlaces.get(key) : undefined);

        const place: Place = matched ?? { children: new Map<string, Place>(), members: new Map<string, Line>(), order: [] };

        if (group && !place.header && place.members.size === 0) {
            place.header = node;

            place.order = (node.children ?? []).flatMap<null | string>(child => child.dimensions?.length ? [keyOf(child)] : keyOf(child) === key ? [null] : []);
        }

        if (line) {
            place.line ??= { cells: new Map(), node: line };

            place.line.cells.set(column, line);
        }

        if (place.header && place.line && !place.order.includes(null)) place.order.push(null);

        for (const member of members) {
            const memberKey = keyOf(member);

            let entry = place.members.get(memberKey);

            if (!entry) {
                entry = { cells: new Map(), node: member };

                place.members.set(memberKey, entry);

                if (!place.order.includes(memberKey)) {
                    // The newest placement controls the total's position. Older members precede a trailing total.
                    const trailingTotal = place.order.at(-1) === null;

                    place.order.splice(place.order.length - Number(trailingTotal), 0, memberKey);
                }
            }

            entry.cells.set(column, member);
        }

        // An ancestor found by key moved in this period. Its descendants still need their own unique key
        // to cross the different parent path, even when their immediate parent is the same concept.
        const canKeep = canAdd && !places.has(id);

        addPeriod(
            place.children, children, column, seed, counts, uniquePlaces,
            exactPath && (!matched || matched === exact), Boolean(matched) || canKeep,
        );

        if (matched || !canKeep || (!seed && !place.header && !place.members.size && !place.children.size)) continue;

        places.set(id, place);

        uniquePlaces.set(key, unique && !uniquePlaces.has(key) ? place : null);
    }
}

export function reportedTreeRows(periods: ReadonlyArray<PresentationPeriod>): Array<TreeRow> {
    const places = new Map<string, Place>();

    const uniquePlaces = new Map<string, null | Place>();

    periods.forEach((period, column) => {
        const nodes = period.facts.filter(node => "concept" in node);

        const counts = new Map<string, number>();

        countPlacements(nodes, counts);

        addPeriod(places, nodes, column, places.size === 0, counts, uniquePlaces);
    });

    const rows: Array<TreeRow> = [];

    const usedChartIds = new Set<string>();

    function push(node: Node, cells: Map<number, Node>, path: ReadonlyArray<string>, parentId: null | string, depth: number, hasChildren: boolean, isTotal: boolean, withMembers = false) {
        const key = keyOf(node);

        const id = JSON.stringify(path);

        // An existing concept link resolves to the first occurrence. Further occurrences get path links.
        const chartId = usedChartIds.has(key) ? `path:${id}` : key;

        usedChartIds.add(key);

        rows.push({
            chartId,
            depth,
            hasChildren,
            id,
            isTotal,
            label: ((withMembers || node.dimensions?.length) ? node.company_label : null) ?? (node.label || node.concept),
            metricId: key,
            nodes: cells,
            parentId,
            preserve: Boolean(node.dimensions?.length || isGroup(node) || withMembers),
            title: node.dimensions?.length ? dimensionsText(node.dimensions) : undefined,
            values: Object.fromEntries(periods.map((period, index) => [period.label, cells.get(index)?.value])),
        });

        return id;
    }

    function flatten(branch: Map<string, Place>, parentPath: ReadonlyArray<string>, parentId: null | string, depth: number) {
        for (const [id, place] of branch) {
            const path = [...parentPath, id];

            const emitLine = (lineParent: null | string, lineDepth: number) => {
                const line = place.line;

                if (!line) return;

                const lineId = push(line.node, line.cells, [...path, "line"], lineParent, lineDepth, place.children.size > 0 || (!place.header && place.members.size > 0), Boolean(line.node.is_total || place.header || place.members.size > 0), place.members.size > 0);

                flatten(place.children, path, lineId, lineDepth + 1);

                if (!place.header) emitMembers(lineId, lineDepth + 1);
            };

            const emitMembers = (idOfParent: string, memberDepth: number) => {
                for (const key of place.order) {
                    if (key === null) {
                        emitLine(idOfParent, memberDepth);

                        continue;
                    }

                    const member = place.members.get(key);

                    if (member) push(member.node, member.cells, [...path, key], idOfParent, memberDepth, false, false);
                }
            };

            if (place.header) {
                const headerId = push(place.header, new Map(), [...path, "header"], parentId, depth, true, false);

                emitMembers(headerId, depth + 1);

                if (!place.line) flatten(place.children, path, headerId, depth + 1);
            }
            else {
                emitLine(parentId, depth);
            }
        }
    }

    flatten(places, [], null, 0);

    return rows;
}
