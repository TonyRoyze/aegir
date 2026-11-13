import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyOrderConstraints,
  isEventOrderValid,
  optimizeConstrainedEventOrder,
  resolveEventOrder,
  scoreEventOrder,
} from "../lib/event-order-constraints";
import {
  loadOrderEditorState,
  saveOrderEditorState,
} from "../lib/event-order-editor-state";
import { getEventConflictMatrix } from "../lib/event-rest-utils";

const events = [
  "M:200m Freestyle",
  "W:100m Backstroke",
  "M:100m Freestyle",
  "W:50m Freestyle",
  "M:4x50m Medley Relay",
];
const entries = [
  {
    student: { id: "a", name: "A" },
    events: [events[0], events[2], events[4]],
  },
  { student: { id: "b", name: "B" }, events: [events[0], events[4]] },
  { student: { id: "c", name: "C" }, events: [events[1], events[3]] },
];
test("optimizer keeps freestyle first and medley relay last, with every event once", () => {
  const constraints = {
    locks: { [events[0]]: 0, [events[4]]: 4 },
    connections: [{ before: events[1], after: events[3] }],
  };
  const result = optimizeConstrainedEventOrder(entries, events, constraints);
  assert.equal(result.order[0], events[0]);
  assert.equal(result.order[4], events[4]);
  assert.equal(new Set(result.order).size, events.length);
  assert.equal(isEventOrderValid(result.order, constraints), true);
  assert.ok(result.score.adjacent <= scoreEventOrder(entries, events).adjacent);
  assert.equal(result.exact, true);
});
test("small search attains minimum conflicts among every valid permutation", () => {
  const constraints = {
    locks: { [events[0]]: 0 },
    connections: [{ before: events[1], after: events[3] }],
  };
  let minimum = Infinity;
  const permute = (prefix: string[], rest: string[]) => {
    if (!rest.length) {
      if (isEventOrderValid(prefix, constraints))
        minimum = Math.min(minimum, scoreEventOrder(entries, prefix).adjacent);
      return;
    }
    rest.forEach((event, index) =>
      permute(
        [...prefix, event],
        rest.filter((_, i) => i !== index),
      ),
    );
  };
  permute([], events);
  assert.equal(
    optimizeConstrainedEventOrder(entries, events, constraints).score.adjacent,
    minimum,
  );
});
test("arrows reorder events without dislodging fixed slots", () => {
  const constraints = {
    locks: { [events[0]]: 0, [events[4]]: 4 },
    connections: [
      { before: events[3], after: events[1] },
      { before: events[1], after: events[2] },
    ],
  };
  const result = resolveEventOrder(events, constraints);
  assert.equal(isEventOrderValid(result, constraints), true);
  assert.deepEqual(result, [
    events[0],
    events[3],
    events[1],
    events[2],
    events[4],
  ]);
});
test("duplicate locks, cycles, self-links and infeasible constraints are rejected", () => {
  assert.throws(
    () =>
      resolveEventOrder(events, {
        locks: { [events[0]]: 0, [events[1]]: 0 },
        connections: [],
      }),
    /already locked/,
  );
  assert.throws(
    () =>
      resolveEventOrder(events, {
        locks: {},
        connections: [
          { before: events[0], after: events[1] },
          { before: events[1], after: events[0] },
        ],
      }),
    /loop/,
  );
  assert.throws(
    () =>
      resolveEventOrder(events, {
        locks: {},
        connections: [{ before: events[0], after: events[0] }],
      }),
    /itself/,
  );
  assert.throws(
    () =>
      resolveEventOrder(events, {
        locks: { [events[0]]: 0 },
        connections: [{ before: events[1], after: events[0] }],
      }),
    /conflict/,
  );
  assert.throws(
    () =>
      resolveEventOrder(events, {
        locks: { [events[0]]: 0, [events[4]]: 1 },
        connections: [
          { before: events[0], after: events[1] },
          { before: events[1], after: events[4] },
        ],
      }),
    /conflict/,
  );
});
test("overlap counts deduplicate stable swimmer identity, including relay entries", () => {
  const matrix = getEventConflictMatrix([...entries, entries[0]], events);
  assert.equal(matrix[0][4], 2);
  assert.equal(matrix[4][0], 2);
  assert.equal(matrix[0][0], 0);
});
test("larger programs preserve locks/precedence and never worsen adjacent conflicts", () => {
  const program = Array.from({ length: 20 }, (_, i) => `Event ${i}`);
  const swimmers = Array.from({ length: 35 }, (_, i) => ({
    student: { id: `s${i}` },
    events: [program[i % 20], program[(i + 1) % 20], program[(i + 3) % 20]],
  }));
  const constraints = {
    locks: { [program[0]]: 0, [program[19]]: 19 },
    connections: [{ before: program[1], after: program[9] }],
  };
  const result = optimizeConstrainedEventOrder(swimmers, program, constraints);
  assert.equal(result.exact, false);
  assert.equal(isEventOrderValid(result.order, constraints), true);
  assert.ok(
    result.score.adjacent <= scoreEventOrder(swimmers, program).adjacent,
  );
  assert.deepEqual(result.score, scoreEventOrder(swimmers, result.order));
});
test("empty, one-event and fully locked programs remain valid", () => {
  assert.deepEqual(
    optimizeConstrainedEventOrder([], [], emptyOrderConstraints()).order,
    [],
  );
  assert.deepEqual(
    optimizeConstrainedEventOrder([], ["one"], {
      locks: { one: 0 },
      connections: [],
    }).order,
    ["one"],
  );
  assert.deepEqual(
    optimizeConstrainedEventOrder(entries, events, {
      locks: Object.fromEntries(events.map((event, i) => [event, i])),
      connections: [],
    }).order,
    events,
  );
});
test("canvas state persists per meet, restores locks and filters retired events", () => {
  const original = globalThis.window;
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage, dispatchEvent: () => true },
  });
  try {
    const state = loadOrderEditorState("a", events);
    state.constraints.locks[events[0]] = 0;
    state.constraints.locks[events[4]] = 4;
    state.constraints.connections = [{ before: events[1], after: events[2] }];
    state.positions[events[1]] = { x: 800, y: 200 };
    saveOrderEditorState("a", state);
    assert.deepEqual(loadOrderEditorState("a", events), state);
    assert.deepEqual(
      loadOrderEditorState("b", events).constraints,
      emptyOrderConstraints(),
    );
    const updated = loadOrderEditorState("a", events.slice(0, 4));
    assert.equal(updated.constraints.locks[events[4]], undefined);
    assert.equal(updated.order.length, 4);
    values.set("aegir-order-canvas:a", "malformed");
    assert.deepEqual(
      loadOrderEditorState("a", events).constraints,
      emptyOrderConstraints(),
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: original,
    });
  }
});
