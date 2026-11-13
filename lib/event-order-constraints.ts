import {
  getEventConflictMatrix,
  type RegistrationLike,
} from "./event-rest-utils";

export type EventConnection = { before: string; after: string };
/** Slots are zero-based in storage and one-based in the interface. */
export type OrderConstraints = {
  locks: Record<string, number>;
  connections: EventConnection[];
};
export type ConflictScore = { adjacent: number; restPenalty: number };
export const emptyOrderConstraints = (): OrderConstraints => ({
  locks: {},
  connections: [],
});

export function validateOrderConstraints(
  events: string[],
  constraints: OrderConstraints,
) {
  if (new Set(events).size !== events.length)
    throw new Error("Event names must be unique.");
  const slots = new Set<number>();
  for (const [event, slot] of Object.entries(constraints.locks)) {
    if (
      !events.includes(event) ||
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= events.length
    )
      throw new Error("Choose a valid position for each locked event.");
    if (slots.has(slot))
      throw new Error(
        `Position ${slot + 1} is already locked to another event.`,
      );
    slots.add(slot);
  }
  const successors = new Map(events.map((event) => [event, new Set<string>()]));
  const indegree = new Map(events.map((event) => [event, 0]));
  for (const edge of constraints.connections) {
    if (!successors.has(edge.before) || !successors.has(edge.after))
      throw new Error("A connection refers to an event that no longer exists.");
    if (edge.before === edge.after)
      throw new Error("An event cannot connect to itself.");
    if (!successors.get(edge.before)!.has(edge.after)) {
      successors.get(edge.before)!.add(edge.after);
      indegree.set(edge.after, indegree.get(edge.after)! + 1);
    }
  }
  const ready = events.filter((event) => indegree.get(event) === 0);
  let visited = 0;
  for (let i = 0; i < ready.length; i++) {
    visited++;
    for (const next of successors.get(ready[i])!) {
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) ready.push(next);
    }
  }
  if (visited !== events.length)
    throw new Error(
      "That connection creates a loop. Remove an arrow before connecting these events.",
    );
}

export function isEventOrderValid(
  order: string[],
  constraints: OrderConstraints,
): boolean {
  const positions = new Map(order.map((event, index) => [event, index]));
  return (
    new Set(order).size === order.length &&
    Object.entries(constraints.locks).every(
      ([event, slot]) => positions.get(event) === slot,
    ) &&
    constraints.connections.every(
      (edge) =>
        positions.has(edge.before) &&
        positions.has(edge.after) &&
        positions.get(edge.before)! < positions.get(edge.after)!,
    )
  );
}

/** Find a feasible schedule with exact locks, preserving the preferred order when possible. */
export function resolveEventOrder(
  preferred: string[],
  constraints: OrderConstraints,
): string[] {
  validateOrderConstraints(preferred, constraints);
  if (isEventOrderValid(preferred, constraints)) return [...preferred];
  const n = preferred.length;
  const earliest = new Map(
    preferred.map((event) => [event, constraints.locks[event] ?? 0]),
  );
  const latest = new Map(
    preferred.map((event) => [event, constraints.locks[event] ?? n - 1]),
  );
  // Propagate both ends of every precedence interval, including exact locked slots.
  for (let pass = 0; pass < n; pass++)
    for (const { before, after } of constraints.connections) {
      earliest.set(
        after,
        Math.max(earliest.get(after)!, earliest.get(before)! + 1),
      );
      latest.set(before, Math.min(latest.get(before)!, latest.get(after)! - 1));
    }
  for (const event of preferred)
    if (earliest.get(event)! > latest.get(event)!)
      throw new Error(
        "Those arrows conflict with the locked positions. Unlock an event or remove a connection.",
      );
  const fixed = new Map(
    Object.entries(constraints.locks).map(([event, slot]) => [slot, event]),
  );
  const predecessors = new Map(
    preferred.map((event) => [
      event,
      constraints.connections
        .filter((edge) => edge.after === event)
        .map((edge) => edge.before),
    ]),
  );
  const chosen = new Set<string>();
  const result: string[] = [];
  const failed = new Set<string>();
  let attempts = 0;
  const search = (): boolean => {
    if (result.length === n) return true;
    if (++attempts > 50_000)
      throw new Error(
        "This combination is too complex to arrange. Remove a connection or a lock and try again.",
      );
    const slot = result.length;
    const remaining = preferred.filter((event) => !chosen.has(event));
    if (remaining.some((event) => latest.get(event)! < slot)) return false;
    const key = remaining.join("\u0000");
    if (failed.has(key)) return false;
    const pinned = fixed.get(slot);
    const candidates = (
      pinned
        ? [pinned]
        : remaining.filter((event) => constraints.locks[event] === undefined)
    )
      .filter(
        (event) =>
          !chosen.has(event) &&
          earliest.get(event)! <= slot &&
          latest.get(event)! >= slot &&
          predecessors.get(event)!.every((parent) => chosen.has(parent)),
      )
      .sort(
        (a, b) =>
          latest.get(a)! - latest.get(b)! ||
          preferred.indexOf(a) - preferred.indexOf(b),
      );
    for (const event of candidates) {
      chosen.add(event);
      result.push(event);
      if (search()) return true;
      chosen.delete(event);
      result.pop();
    }
    failed.add(key);
    return false;
  };
  if (!search())
    throw new Error(
      "No order satisfies these arrows and locked positions. Remove a constraint and try again.",
    );
  return result;
}

function scoreIndices(order: number[], weights: number[][]): ConflictScore {
  let adjacent = 0;
  let restPenalty = 0;
  for (let i = 0; i < order.length; i++)
    for (let j = i + 1; j < order.length; j++) {
      const shared = weights[order[i]][order[j]];
      if (j === i + 1) adjacent += shared;
      restPenalty += shared / (j - i) ** 2;
    }
  return { adjacent, restPenalty };
}
const improves = (a: ConflictScore, b: ConflictScore) =>
  a.adjacent < b.adjacent ||
  (a.adjacent === b.adjacent && a.restPenalty < b.restPenalty - 1e-9);
export function scoreEventOrder(
  registrations: RegistrationLike[],
  order: string[],
): ConflictScore {
  return scoreIndices(
    order.map((_, i) => i),
    getEventConflictMatrix(registrations, order),
  );
}

export function optimizeConstrainedEventOrder(
  registrations: RegistrationLike[],
  preferred: string[],
  constraints: OrderConstraints,
) {
  const feasible = resolveEventOrder(preferred, constraints);
  const weights = getEventConflictMatrix(registrations, preferred);
  const ids = new Map(preferred.map((event, i) => [event, i]));
  let best = feasible.map((event) => ids.get(event)!);
  let bestScore = scoreIndices(best, weights);
  const n = best.length;
  const fixed = new Map(
    Object.entries(constraints.locks).map(([event, slot]) => [
      slot,
      ids.get(event)!,
    ]),
  );
  const edges = constraints.connections.map((edge) => [
    ids.get(edge.before)!,
    ids.get(edge.after)!,
  ]);
  const valid = (candidate: number[]) => {
    const positions = new Map(candidate.map((id, slot) => [id, slot]));
    return edges.every(
      ([before, after]) => positions.get(before)! < positions.get(after)!,
    );
  };
  // Exhaustive small-program search; larger programs use a bounded local search.
  if (n <= 9) {
    const path: number[] = [];
    const used = new Set<number>();
    const search = (adjacent: number) => {
      if (adjacent > bestScore.adjacent) return;
      if (path.length === n) {
        const score = scoreIndices(path, weights);
        if (improves(score, bestScore)) {
          best = [...path];
          bestScore = score;
        }
        return;
      }
      const slot = path.length;
      const pin = fixed.get(slot);
      for (const id of pin === undefined ? best : [pin]) {
        if (
          used.has(id) ||
          (pin === undefined && [...fixed.values()].includes(id))
        )
          continue;
        if (edges.some(([before, after]) => after === id && !used.has(before)))
          continue;
        const nextPenalty = path.length
          ? weights[path[path.length - 1]][id]
          : 0;
        used.add(id);
        path.push(id);
        search(adjacent + nextPenalty);
        path.pop();
        used.delete(id);
      }
    };
    search(0);
  } else {
    let evaluations = 0;
    // Score a swap in O(n), only touching distances involving the two moved events.
    const swapScore = (
      order: number[],
      score: ConflictScore,
      a: number,
      b: number,
    ): ConflictScore => {
      let restPenalty = score.restPenalty;
      for (let k = 0; k < n; k++)
        if (k !== a && k !== b) {
          const first = weights[order[a]][order[k]],
            second = weights[order[b]][order[k]];
          restPenalty +=
            (second - first) / (k - a) ** 2 + (first - second) / (k - b) ** 2;
        }
      let adjacent = score.adjacent;
      for (const k of new Set([a - 1, a, b - 1, b]))
        if (k >= 0 && k < n - 1) {
          const value = (slot: number) =>
            order[slot === a ? b : slot === b ? a : slot];
          adjacent +=
            weights[value(k)][value(k + 1)] - weights[order[k]][order[k + 1]];
        }
      return { adjacent, restPenalty };
    };
    for (let start = 0; start < 5 && evaluations < 30_000; start++) {
      const rotated = [...preferred.slice(start), ...preferred.slice(0, start)];
      let current = (
        start === 0 ? feasible : resolveEventOrder(rotated, constraints)
      ).map((event) => ids.get(event)!);
      let score = scoreIndices(current, weights);
      for (let pass = 0; pass < 30; pass++) {
        let next: number[] | null = null;
        let nextScore = score;
        for (let a = 0; a < n && evaluations < 30_000; a++)
          for (let b = a + 1; b < n && evaluations < 30_000; b++) {
            if (fixed.has(a) || fixed.has(b)) continue;
            evaluations++;
            const candidate = [...current];
            [candidate[a], candidate[b]] = [candidate[b], candidate[a]];
            if (!valid(candidate)) continue;
            const candidateScore = swapScore(current, score, a, b);
            if (improves(candidateScore, nextScore)) {
              next = candidate;
              nextScore = candidateScore;
            }
          }
        if (!next) break;
        current = next;
        score = nextScore;
      }
      if (improves(score, bestScore)) {
        best = current;
        bestScore = score;
      }
    }
  }
  return {
    order: best.map((id) => preferred[id]),
    score: scoreIndices(best, weights),
    exact: n <= 9,
  };
}
