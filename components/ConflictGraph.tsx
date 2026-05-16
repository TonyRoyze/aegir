"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";
import { Button } from "@/components/ui/button";

interface RegistrationLike {
  id?: string;
  student?: {
    _id?: string;
    id?: string;
    name?: string;
    registrationNumber?: string;
  };
  events: string[];
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  idx: number;
  totalConflicts: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  count: number;
  swimmers: string[];
  _optimal: boolean;
  _manual: boolean;
}

const R = 10;

function getNode(source: string | number | GraphNode): string {
  if (typeof source === "string") return source;
  if (typeof source === "number") return String(source);
  return source.id;
}

function buildPairwiseConflicts(
  events: string[],
  registrations: RegistrationLike[],
) {
  const byEvent = new Map<string, Map<string, string>>();
  for (const e of events) byEvent.set(e, new Map());

  registrations.forEach((reg, idx) => {
    const key = reg.student?._id || reg.student?.id || reg.id || `s-${idx}`;
    const name =
      reg.student?.name ||
      reg.student?.registrationNumber ||
      `Student ${idx + 1}`;
    for (const e of reg.events) byEvent.get(e)?.set(key, name);
  });

  const linkData: Array<{
    source: string;
    target: string;
    count: number;
    swimmers: string[];
  }> = [];
  const conflictCount = new Map<string, number>();

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      const pa = byEvent.get(a);
      const pb = byEvent.get(b);
      if (!pa || !pb) continue;

      const shared: string[] = [];
      pa.forEach((name, key) => {
        if (pb.has(key)) shared.push(name);
      });

      linkData.push({
        source: a,
        target: b,
        count: shared.length,
        swimmers: shared,
      });
      if (shared.length > 0) {
        conflictCount.set(a, (conflictCount.get(a) || 0) + shared.length);
        conflictCount.set(b, (conflictCount.get(b) || 0) + shared.length);
      }
    }
  }

  return { linkData, conflictCount };
}

interface EventInfo {
  name: string;
  gender: "M" | "W" | null;
  base: string;
  isMedley: boolean;
  isFreeRelay: boolean;
}

interface Group {
  events: string[];
  isMedley: boolean;
  isFreeRelay: boolean;
}

function classifyEvent(name: string): EventInfo {
  const gender = name.startsWith("M:")
    ? ("M" as const)
    : name.startsWith("W:")
      ? ("W" as const)
      : null;
  const base = gender ? name.slice(2).trim() : name;
  const lower = name.toLowerCase();
  return {
    name,
    gender,
    base,
    isMedley: lower.includes("medley") && lower.includes("relay"),
    isFreeRelay: lower.includes("relay") && !lower.includes("medley"),
  };
}

function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >>> 24;
}

function buildGroups(events: string[]): {
  groups: Group[];
  fixed: Map<number, number>;
} {
  const classes = events.map((e) => classifyEvent(e));

  const byBase = new Map<string, EventInfo[]>();
  for (const c of classes) {
    const key = c.base;
    if (!byBase.has(key)) byBase.set(key, []);
    byBase.get(key)!.push(c);
  }

  const groups: Group[] = [];
  const fixed = new Map<number, number>();

  for (const [, items] of byBase) {
    const m = items.find((i) => i.gender === "M");
    const w = items.find((i) => i.gender === "W");
    const unpaired = items.filter((i) => i.gender === null);

    if (m && w) {
      groups.push({
        events: [m.name, w.name],
        isMedley: m.isMedley || w.isMedley,
        isFreeRelay: m.isFreeRelay || w.isFreeRelay,
      });
    } else if (m) {
      groups.push({
        events: [m.name],
        isMedley: m.isMedley,
        isFreeRelay: m.isFreeRelay,
      });
    } else if (w) {
      groups.push({
        events: [w.name],
        isMedley: w.isMedley,
        isFreeRelay: w.isFreeRelay,
      });
    }

    for (const item of unpaired) {
      groups.push({
        events: [item.name],
        isMedley: item.isMedley,
        isFreeRelay: item.isFreeRelay,
      });
    }
  }

  const n = groups.length;
  const freeIdx = groups.findIndex((g) => g.isFreeRelay);
  const medIdx = groups.findIndex((g) => g.isMedley);

  if (freeIdx !== -1) fixed.set(n - 1, freeIdx);
  if (medIdx !== -1) fixed.set(Math.floor(n / 2), medIdx);

  return { groups, fixed };
}

function buildGroupWeight(groups: Group[], links: GraphLink[]): number[][] {
  const conflictMap = new Map<string, number>();
  for (const link of links) {
    const s = getNode(link.source);
    const t = getNode(link.target);
    conflictMap.set(`${s}|${t}`, link.count);
    conflictMap.set(`${t}|${s}`, link.count);
  }

  function get(a: string, b: string): number {
    return conflictMap.get(`${a}|${b}`) ?? 0;
  }

  const n = groups.length;
  const w: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const last = groups[i].events[groups[i].events.length - 1];
      const first = groups[j].events[0];
      w[i][j] = get(last, first);
    }
  }

  return w;
}

function expandGroups(order: number[], groups: Group[]): string[] {
  const out: string[] = [];
  for (const idx of order) out.push(...groups[idx].events);
  return out;
}

function dpOptimalGroupOrder(
  n: number,
  weight: number[][],
  fixed: Map<number, number>,
): number[] | null {
  const hasFixedPos = new Map<number, number>();
  for (const [pos, idx] of fixed) hasFixedPos.set(idx, pos);

  const size = 1 << n;
  const INF = Infinity;
  const dp: number[][] = Array.from({ length: size }, () => Array(n).fill(INF));
  const parent: number[][] = Array.from({ length: size }, () =>
    Array(n).fill(-1),
  );

  const canPickFirst: number[] = fixed.has(0)
    ? [fixed.get(0)!]
    : Array.from({ length: n }, (_, i) => i).filter((i) => !hasFixedPos.has(i));

  for (const v of canPickFirst) dp[1 << v][v] = 0;

  for (let mask = 1; mask < size; mask++) {
    const step = popcount(mask);

    for (let v = 0; v < n; v++) {
      if (!(mask & (1 << v)) || dp[mask][v] === INF) continue;

      if (fixed.has(step)) {
        const u = fixed.get(step)!;
        if (mask & (1 << u)) continue;
        const nm = mask | (1 << u);
        const nd = dp[mask][v] + (step === 0 ? 0 : weight[v][u]);
        if (nd < dp[nm][u]) {
          dp[nm][u] = nd;
          parent[nm][u] = v;
        }
      } else {
        for (let u = 0; u < n; u++) {
          if (mask & (1 << u)) continue;
          if (hasFixedPos.has(u) && hasFixedPos.get(u) !== step) continue;
          const nm = mask | (1 << u);
          const nd = dp[mask][v] + (step === 0 ? 0 : weight[v][u]);
          if (nd < dp[nm][u]) {
            dp[nm][u] = nd;
            parent[nm][u] = v;
          }
        }
      }
    }
  }

  const full = size - 1;
  let bestEnd = 0;
  let bestW = INF;
  for (let v = 0; v < n; v++) {
    if (dp[full][v] < bestW) {
      bestW = dp[full][v];
      bestEnd = v;
    }
  }

  if (bestW === INF) return null;

  const path: number[] = [];
  let mask = full;
  let v = bestEnd;
  while (mask) {
    path.push(v);
    const p = parent[mask][v];
    mask ^= 1 << v;
    v = p;
  }
  path.reverse();
  return path;
}

function greedyGroupOrder(
  n: number,
  weight: number[][],
  fixed: Map<number, number>,
): number[] {
  const fixedGroupByPos = new Map<number, number>(fixed);
  const fixedPosOfGroup = new Map<number, number>();
  for (const [pos, idx] of fixed) fixedPosOfGroup.set(idx, pos);

  const nonFixed: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!fixedPosOfGroup.has(i)) nonFixed.push(i);
  }

  const starts = Math.min(nonFixed.length, 5);

  function score(order: number[]): number {
    let s = 0;
    for (let i = 0; i < order.length - 1; i++)
      s += weight[order[i]][order[i + 1]];
    return s;
  }

  let best: number[] = [];
  let bestScore = Infinity;

  for (let s = 0; s < starts; s++) {
    const order: number[] = Array(n).fill(-1);

    for (const [pos, idx] of fixedGroupByPos) order[pos] = idx;

    const used = new Set(fixedGroupByPos.values());
    const remaining = nonFixed.filter((_, i) => i !== s);
    let last = nonFixed[s];
    let lastPos = -1;

    for (let pos = 0; pos < n; pos++) {
      if (order[pos] !== -1) {
        last = order[pos];
        lastPos = pos;
        break;
      }
    }
    if (lastPos === -1) {
      last = nonFixed[s];
      lastPos = 0;
    }
    order[lastPos] = last;
    used.add(last);

    let insertIdx = 0;
    while (insertIdx < n && order[insertIdx] !== -1) insertIdx++;

    for (const next of remaining) {
      let bestPos = -1;
      let bestAdj = Infinity;

      for (let pos = 0; pos < n; pos++) {
        if (order[pos] !== -1) continue;
        const prev = pos > 0 ? order[pos - 1] : -1;
        const nextN = pos < n - 1 ? order[pos + 1] : -1;
        let adj = 0;
        if (prev !== -1) adj += weight[prev][next];
        if (nextN !== -1) adj += weight[next][nextN];
        if (adj < bestAdj) {
          bestAdj = adj;
          bestPos = pos;
        }
      }

      order[bestPos] = next;
    }

    const sVal = score(order);
    if (sVal < bestScore) {
      bestScore = sVal;
      best = [...order];
    }
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < n - 1; i++) {
      if (fixedGroupByPos.has(i)) continue;
      for (let j = i + 1; j < n; j++) {
        if (fixedGroupByPos.has(j)) continue;
        if (fixedGroupByPos.has(i) || fixedGroupByPos.has(j)) continue;

        const rev = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];

        let ok = true;
        for (const [pos, idx] of fixedGroupByPos) {
          if (rev[pos] !== idx) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        const sVal = score(rev);
        if (sVal < bestScore) {
          bestScore = sVal;
          best = rev;
          improved = true;
        }
      }
    }
  }

  return best;
}

function computeOptimalOrder(
  events: string[],
  links: GraphLink[],
): string[] | null {
  if (events.length <= 2) return events;

  const { groups, fixed } = buildGroups(events);
  if (groups.length <= 2)
    return expandGroups(
      Array.from({ length: groups.length }, (_, i) => i),
      groups,
    );

  const weight = buildGroupWeight(groups, links);

  const groupOrder: number[] | null =
    groups.length > 20
      ? greedyGroupOrder(groups.length, weight, fixed)
      : dpOptimalGroupOrder(groups.length, weight, fixed);

  if (!groupOrder) return null;
  return expandGroups(groupOrder, groups);
}

export function ConflictGraph({
  orderedEvents,
  registrations,
  onApplyPath,
}: {
  orderedEvents: string[];
  registrations: RegistrationLike[];
  onApplyPath?: (path: string[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const d3Ref = useRef<{
    sim: d3.Simulation<GraphNode, GraphLink>;
    links: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown>;
    nodes: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>;
  } | null>(null);
  const gRef = useRef<d3.Selection<
    SVGGElement,
    unknown,
    null,
    undefined
  > | null>(null);
  const [showOptimal, setShowOptimal] = useState(false);
  const [useMerged, setUseMerged] = useState(false);
  const [hiddenCounts, setHiddenCounts] = useState<Set<number>>(new Set());
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  isEditingRef.current = isEditing;
  const toggleCount = (c: number) =>
    setHiddenCounts((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const normalEvents = useMemo(() => {
    const normal: string[] = [];
    for (const e of orderedEvents) {
      const info = classifyEvent(e);
      if (!info.isFreeRelay && !info.isMedley) normal.push(e);
    }
    return normal;
  }, [orderedEvents]);

  const { nodes, links } = useMemo((): {
    nodes: GraphNode[];
    links: GraphLink[];
  } => {
    const { linkData, conflictCount } = buildPairwiseConflicts(
      normalEvents,
      registrations,
    );

    return {
      nodes: normalEvents.map((name, i) => ({
        id: name,
        name,
        idx: i,
        totalConflicts: conflictCount.get(name) || 0,
      })) as GraphNode[],
      links: linkData.map(
        (l): GraphLink => ({
          source: l.source,
          target: l.target,
          count: l.count,
          swimmers: l.swimmers,
          _optimal: false,
          _manual: false,
        }),
      ),
    };
  }, [normalEvents, registrations]);

  const mergedNodes = useMemo(() => {
    const byBase = new Map<string, { totalConflicts: number; idx: number }>();
    let idx = 0;
    for (const node of nodes) {
      const base = classifyEvent(node.name).base;
      const existing = byBase.get(base);
      if (existing) {
        existing.totalConflicts += node.totalConflicts;
      } else {
        byBase.set(base, { totalConflicts: node.totalConflicts, idx: idx++ });
      }
    }
    return Array.from(byBase.entries()).map(([base, data]) => ({
      id: base,
      name: base,
      idx: data.idx,
      totalConflicts: data.totalConflicts,
    })) as GraphNode[];
  }, [nodes]);

  const mergedLinks = useMemo(() => {
    const byBase = new Map<string, number>();
    const swimmersByKey = new Map<string, string[]>();
    for (const link of links) {
      const src = classifyEvent(getNode(link.source)).base;
      const tgt = classifyEvent(getNode(link.target)).base;
      if (src === tgt) continue;
      const key = src < tgt ? `${src}|${tgt}` : `${tgt}|${src}`;
      byBase.set(key, (byBase.get(key) || 0) + link.count);
      if (!swimmersByKey.has(key)) swimmersByKey.set(key, []);
      swimmersByKey.get(key)!.push(...link.swimmers);
    }
    return Array.from(byBase.entries()).map(([key, count]) => {
      const [src, tgt] = key.split("|");
      return {
        source: src,
        target: tgt,
        count,
        swimmers: swimmersByKey.get(key) || [],
        _optimal: false,
        _manual: false,
      } as GraphLink;
    });
  }, [links]);

  const displayNodes = useMerged ? mergedNodes : nodes;
  const displayLinks = useMerged ? mergedLinks : links;

  const filteredLinks = useMemo(() => {
    if (hiddenCounts.size === 0) return displayLinks;
    return displayLinks.filter((l) => !hiddenCounts.has(l.count));
  }, [displayLinks, hiddenCounts]);

  const allCounts = useMemo(() => {
    const counts = new Set(displayLinks.map((l) => l.count));
    return Array.from(counts).sort((a, b) => a - b);
  }, [displayLinks]);

  const optimalPath = useMemo(() => {
    const basePath = computeOptimalOrder(normalEvents, links);
    if (!basePath) return null;

    return basePath;
  }, [normalEvents, links]);

  const optimalPathChips = useMemo(() => {
    if (!optimalPath) return [];
    const chips: { label: string; events: string[] }[] = [];
    for (let i = 0; i < optimalPath.length; i++) {
      const curr = optimalPath[i];
      const next = optimalPath[i + 1];
      const currInfo = classifyEvent(curr);
      const nextInfo = next ? classifyEvent(next) : null;
      if (
        currInfo.gender === "M" &&
        nextInfo?.gender === "W" &&
        currInfo.base === nextInfo.base
      ) {
        chips.push({ label: currInfo.base, events: [curr, next] });
        i++;
      } else {
        chips.push({ label: curr.replace(/^[MW]:\s*/, ""), events: [curr] });
      }
    }
    return chips;
  }, [optimalPath]);

  useEffect(() => {
    if (!svgRef.current || displayNodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const height = 600;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g");

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0.3, 4])
        .filter((event: MouseEvent | WheelEvent | TouchEvent) => {
          if ("button" in event) {
            return !event.button || event.button === 1;
          }
          return true;
        })
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        }),
    );

    g.append("g").attr("class", "ol");

    const linkSelection = g
      .append("g")
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(filteredLinks, (d) => `${getNode(d.source)}|${getNode(d.target)}`)
      .join("line")
      .attr("stroke", (d) => (d.count === 0 ? "#60a5fa" : "#fca5a5"))
      .attr("stroke-width", (d) => Math.max(1.5, (d.count + 1) * 0.8))
      .attr("stroke-opacity", 0.4)
      .attr("stroke-dasharray", (d) => (d.count === 0 ? "4 3" : "none"));

    linkSelection
      .append("title")
      .text(
        (d) =>
          `${d.count} conflict${d.count === 1 ? "" : "s"}: ${d.swimmers.join(", ")}`,
      );

    const linkLabelData = filteredLinks.map((d) => ({
      source: getNode(d.source),
      target: getNode(d.target),
      count: d.count,
    }));
    g.append("g")
      .attr("class", "el")
      .selectAll<
        SVGTextElement,
        { source: string; target: string; count: number }
      >("text")
      .data(linkLabelData, (d) => `${d.source}|${d.target}`)
      .join("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 8)
      .attr("fill", (d) => (d.count === 0 ? "#60a5fa" : "#9ca3af"))
      .attr("font-weight", 600)
      .style("pointer-events", "none")
      .text((d) => String(d.count));

    const nodeSelection = g
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(displayNodes, (d) => d.id)
      .join("g");

    nodeSelection
      .append("circle")
      .attr("r", R)
      .attr("fill", (d) => (d.totalConflicts > 0 ? "#fef2f2" : "#ffffff"))
      .attr("stroke", (d) => (d.totalConflicts > 0 ? "#dc2626" : "#d1d5db"))
      .attr("stroke-width", 2);

    nodeSelection
      .append("text")
      .text((d) => d.name.replace(/^[MW]:\s*/, ""))
      .attr("x", R + 6)
      .attr("y", 4)
      .attr("font-size", 12)
      .attr("fill", "#374151");

    nodeSelection
      .append("title")
      .text(
        (d) =>
          `${d.name}\n${d.totalConflicts} total conflict${d.totalConflicts === 1 ? "" : "s"}`,
      );

    let dragged = false;
    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (event, d) => {
        dragged = false;
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        dragged = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeSelection.call(drag);

    nodeSelection.on("click", (_event, d) => {
      if (dragged || !isEditingRef.current) return;
      setManualOrder((prev) => {
        const idx = prev.indexOf(d.id);
        if (idx === prev.length - 1) return prev.slice(0, -1);
        if (idx !== -1) return prev.slice(0, idx + 1);
        return [...prev, d.id];
      });
    });

    nodeSelection
      .on("mouseenter", function (event, d) {
        const connected = new Set<string>();
        for (const l of filteredLinks) {
          const s = getNode(l.source);
          const t = getNode(l.target);
          if (s === d.id) connected.add(t);
          if (t === d.id) connected.add(s);
        }

        linkSelection
          .transition()
          .duration(200)
          .attr("stroke-opacity", (l) => {
            const s = getNode(l.source);
            const t = getNode(l.target);
            return s === d.id || t === d.id ? 0.8 : 0.05;
          })
          .attr("stroke-width", (l) => {
            const s = getNode(l.source);
            const t = getNode(l.target);
            return s === d.id || t === d.id
              ? Math.max(2.5, (l.count + 1) * 1.5)
              : Math.max(1.5, (l.count + 1) * 0.8);
          })
          .attr("stroke-dasharray", (l) => {
            const s = getNode(l.source);
            const t = getNode(l.target);
            if (s !== d.id && t !== d.id) return l.count === 0 ? "4 3" : "none";
            return l.count === 0 ? "none" : "none";
          });

        nodeSelection
          .transition()
          .duration(200)
          .attr("opacity", (n) =>
            n.id === d.id || connected.has(n.id) ? 1 : 0.2,
          );
      })
      .on("mouseleave", function () {
        linkSelection
          .transition()
          .duration(300)
          .attr("stroke-opacity", (l) => (l._manual || l._optimal ? 1 : 0.4))
          .attr("stroke", (l) =>
            l._manual || l._optimal ? "#16a34a" : l.count === 0 ? "#60a5fa" : "#fca5a5",
          )
          .attr("stroke-dasharray", (l) =>
            l._manual || l._optimal ? "none" : l.count === 0 ? "4 3" : "none",
          );

        nodeSelection.transition().duration(300).attr("opacity", 1);
      });

    const sim = d3
      .forceSimulation<GraphNode>(displayNodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(filteredLinks)
          .id((d) => d.id)
          .distance((d) => Math.max(60, 400 / (d.count + 2)))
          .strength((d) => Math.min(0.5, (d.count + 1) * 0.02)),
      )
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(R + 60))
      .on("tick", () => {
        linkSelection
          .attr("x1", (d) => (d.source as GraphNode).x!)
          .attr("y1", (d) => (d.source as GraphNode).y!)
          .attr("x2", (d) => (d.target as GraphNode).x!)
          .attr("y2", (d) => (d.target as GraphNode).y!);

        nodeSelection.attr("transform", (d) => `translate(${d.x},${d.y})`);

        const labelPos = new Map<string, { x: number; y: number }>();
        linkSelection.each(function (d: GraphLink) {
          const src = d.source as GraphNode;
          const tgt = d.target as GraphNode;
          if (src.x == null || tgt.x == null) return;
          const key = `${getNode(d.source)}|${getNode(d.target)}`;
          labelPos.set(key, {
            x: (src.x + tgt.x) / 2,
            y: (src.y! + tgt.y!) / 2 - 8,
          });
        });

        g.select(".el")
          .selectAll<
            SVGTextElement,
            { source: string; target: string; count: number }
          >("text")
          .attr("x", (d) => labelPos.get(`${d.source}|${d.target}`)?.x ?? 0)
          .attr("y", (d) => labelPos.get(`${d.source}|${d.target}`)?.y ?? 0);

        g.select(".ol")
          .selectAll<SVGTextElement, { sx: number; sy: number; count: number }>(
            "text",
          )
          .attr("x", (d) => d.sx)
          .attr("y", (d) => d.sy);
      });

    d3Ref.current = { sim, links: linkSelection, nodes: nodeSelection };
    gRef.current = g;

    return () => {
      sim.stop();
      d3Ref.current = null;
    };
  }, [displayNodes, filteredLinks]);

  useEffect(() => {
    if (!d3Ref.current || !gRef.current) return;

    const manualPairs = new Set<string>();
    for (let i = 0; i < manualOrder.length - 1; i++) {
      const key = `${manualOrder[i]}|${manualOrder[i + 1]}`;
      manualPairs.add(key);
      manualPairs.add(`${manualOrder[i + 1]}|${manualOrder[i]}`);
    }

    const sameGenderPairs = new Set<string>();

    if (showOptimal && optimalPath) {
      for (let i = 0; i < optimalPath.length; i++) {
        const currG = classifyEvent(optimalPath[i]).gender;
        if (!currG) continue;
        for (let j = i + 1; j < optimalPath.length; j++) {
          if (
            classifyEvent(optimalPath[j]).gender === currG &&
            classifyEvent(optimalPath[j]).base !==
              classifyEvent(optimalPath[i]).base
          ) {
            const key = `${optimalPath[i]}|${optimalPath[j]}`;
            sameGenderPairs.add(key);
            sameGenderPairs.add(`${optimalPath[j]}|${optimalPath[i]}`);
            break;
          }
        }
      }
    }

    d3Ref.current.links
      .transition()
      .duration(300)
      .attr("stroke", (d: GraphLink) => {
        const s = getNode(d.source);
        const t = getNode(d.target);
        const key = `${s}|${t}`;
        d._manual = manualPairs.has(key);
        d._optimal = sameGenderPairs.has(key);
        const highlighted = d._manual || d._optimal;
        return highlighted ? "#16a34a" : d.count === 0 ? "#60a5fa" : "#fca5a5";
      })
      .attr("stroke-opacity", (d: GraphLink) =>
        d._manual || d._optimal ? 1 : 0.4,
      )
      .attr("stroke-width", (d: GraphLink) =>
        d._manual || d._optimal
          ? Math.max(3, (d.count + 1) * 1.5)
          : Math.max(1.5, (d.count + 1) * 0.8),
      )
      .attr("stroke-dasharray", (d: GraphLink) =>
        d._manual || d._optimal ? "none" : d.count === 0 ? "4 3" : "none",
      );

    const labelG = gRef.current.select(".ol");
    labelG.selectAll("*").remove();

    if (manualOrder.length > 0 || (showOptimal && optimalPath)) {
      const labelData: Array<{ sx: number; sy: number; count: number }> = [];
      d3Ref.current.links.each(function (d: GraphLink) {
        if (!d._manual && !d._optimal) return;
        const src = d.source as GraphNode;
        const tgt = d.target as GraphNode;
        if (src.x != null && tgt.x != null) {
          labelData.push({
            sx: (src.x + tgt.x) / 2,
            sy: (src.y! + tgt.y!) / 2 - 8,
            count: d.count,
          });
        }
      });

      labelG
        .selectAll("text")
        .data(labelData)
        .join("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", 10)
        .attr("font-weight", 700)
        .attr("fill", "#16a34a")
        .attr("x", (d) => d.sx)
        .attr("y", (d) => d.sy)
        .text((d) => String(d.count));
    }
  }, [showOptimal, optimalPath, manualOrder]);

  useEffect(() => {
    if (!d3Ref.current) return;
    d3Ref.current.nodes.style("cursor", isEditing ? "pointer" : "grab");
  }, [isEditing]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        d3.select(svgRef.current).attr("width", entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const currentScore = useMemo(() => {
    if (normalEvents.length < 2) return 0;
    let score = 0;
    for (let i = 0; i < normalEvents.length - 1; i++) {
      const link = links.find(
        (l) =>
          (getNode(l.source) === normalEvents[i] &&
            getNode(l.target) === normalEvents[i + 1]) ||
          (getNode(l.source) === normalEvents[i + 1] &&
            getNode(l.target) === normalEvents[i]),
      );
      if (link) score += link.count;
    }
    return score;
  }, [normalEvents, links]);

  const optimalScore = useMemo(() => {
    if (normalEvents.length < 2) return 0;

    const fullOptimal = optimalPath ?? [];
    if (fullOptimal.length < 2) return 0;
    let score = 0;
    for (let i = 0; i < fullOptimal.length - 1; i++) {
      const link = links.find(
        (l) =>
          (getNode(l.source) === fullOptimal[i] &&
            getNode(l.target) === fullOptimal[i + 1]) ||
          (getNode(l.source) === fullOptimal[i + 1] &&
            getNode(l.target) === fullOptimal[i]),
      );
      if (link) score += link.count;
    }
    return score;
  }, [normalEvents, optimalPath, links]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            Current:{" "}
            <span className="font-semibold text-foreground">
              {currentScore}
            </span>{" "}
            adjacent conflicts
          </span>
          {optimalPath && (
            <span className="text-xs">
              Optimal:{" "}
              <span className="font-semibold text-blue-600">
                {optimalScore}
              </span>{" "}
              conflicts
              {currentScore > 0 && (
                <span className="ml-1 text-emerald-600">
                  (
                  {Math.round(
                    ((currentScore - optimalScore) / currentScore) * 100,
                  )}
                  % better)
                </span>
              )}
            </span>
          )}
        </div>
        {optimalPath && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowOptimal((v) => !v)}
              variant={showOptimal ? "secondary" : "outline"}
              size="sm"
            >
              {showOptimal ? "Hide Optimal Path" : "Show Optimal Path"}
            </Button>
            {showOptimal && onApplyPath && optimalPath && (
              <Button
                onClick={() => onApplyPath(optimalPath)}
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Apply to Event Order
              </Button>
            )}
          </div>
        )}
      </div>

      {showOptimal && optimalPath && (
        <div className="flex flex-wrap gap-1.5 items-center text-xs">
          <span className="text-muted-foreground font-medium mr-1">
            Optimal order:
          </span>
          {optimalPathChips.map((chip, i) => (
            <React.Fragment key={chip.events[0]}>
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200 font-medium whitespace-nowrap">
                {chip.label}
              </span>
              {i < optimalPathChips.length - 1 && (
                <span className="text-muted-foreground/40">&rarr;</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {manualOrder.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center text-xs">
          <span className="text-muted-foreground font-medium mr-1">
            Manual order:
          </span>
          {manualOrder.map((name, i) => (
            <React.Fragment key={name}>
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 font-medium whitespace-nowrap">
                {name.replace(/^[MW]:\s*/, "")}
              </span>
              {i < manualOrder.length - 1 && (
                <span className="text-muted-foreground/40">&rarr;</span>
              )}
            </React.Fragment>
          ))}
          <Button
            onClick={() => setManualOrder([])}
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-6 px-2"
          >
            Clear
          </Button>
          {onApplyPath && manualOrder.length > 1 && (
            <Button
              onClick={() => onApplyPath(manualOrder)}
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700 h-6 px-3 text-xs"
            >
              Apply
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => setIsEditing((v) => !v)}
          variant={isEditing ? "default" : "outline"}
          size="sm"
        >
          {isEditing ? "Done Editing" : "Edit Order"}
        </Button>
        <Button
          onClick={() => setUseMerged((v) => !v)}
          variant={useMerged ? "secondary" : "outline"}
          size="sm"
        >
          {useMerged ? "Merged M/W" : "Split M/W"}
        </Button>
        {allCounts.map((c) => {
          const hidden = hiddenCounts.has(c);
          return (
            <Button
              key={c}
              onClick={() => toggleCount(c)}
              variant={hidden ? "outline" : c === 0 ? "secondary" : "secondary"}
              size="sm"
              className={
                hidden
                  ? "text-muted-foreground/50"
                  : c === 0
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300"
                    : "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-300"
              }
            >
              {c}
            </Button>
          );
        })}
      </div>

      <div ref={containerRef} className="w-full">
        <svg
          ref={svgRef}
          width="100%"
          height={600}
          className="border rounded-lg bg-white"
        />
      </div>

      <p className="text-xs text-muted-foreground -mt-1">
        Drag nodes to explore. Hover a node to highlight its conflict
        connections. Edge thickness = number of shared swimmers.
      </p>
    </div>
  );
}
