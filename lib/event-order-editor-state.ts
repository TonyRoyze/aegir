import {
  loadProgramEventOrder,
  saveProgramEventOrder,
} from "./program-event-order";
import {
  emptyOrderConstraints,
  isEventOrderValid,
  resolveEventOrder,
  type OrderConstraints,
} from "./event-order-constraints";

export type CanvasPoint = { x: number; y: number };
export type OrderEditorState = {
  order: string[];
  constraints: OrderConstraints;
  positions: Record<string, CanvasPoint>;
};
const key = (meetId: string) => `aegir-order-canvas:${meetId}`;
export function arrangeEventCards(
  events: string[],
): Record<string, CanvasPoint> {
  return Object.fromEntries(
    events.map((event, index) => {
      const row = Math.floor(index / 3),
        column = row % 2 ? 2 - (index % 3) : index % 3;
      return [event, { x: 48 + column * 320, y: 48 + row * 204 }];
    }),
  );
}
export function loadOrderEditorState(
  meetId: string,
  events: string[],
): OrderEditorState {
  const order = [...new Set(loadProgramEventOrder(meetId, events))];
  const fallback = {
    order,
    constraints: emptyOrderConstraints(),
    positions: arrangeEventCards(order),
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw: unknown = JSON.parse(
      window.localStorage.getItem(key(meetId)) || "null",
    );
    if (!raw || typeof raw !== "object") return fallback;
    const saved = raw as Record<string, unknown>;
    const constraints = emptyOrderConstraints();
    if (saved.constraints && typeof saved.constraints === "object") {
      const values = saved.constraints as Record<string, unknown>;
      if (values.locks && typeof values.locks === "object") {
        const used = new Set<number>();
        for (const [event, slot] of Object.entries(values.locks))
          if (
            events.includes(event) &&
            typeof slot === "number" &&
            Number.isInteger(slot) &&
            slot >= 0 &&
            slot < events.length &&
            !used.has(slot)
          ) {
            constraints.locks[event] = slot;
            used.add(slot);
          }
      }
      if (Array.isArray(values.connections))
        for (const edge of values.connections) {
          if (
            edge &&
            typeof edge === "object" &&
            typeof edge.before === "string" &&
            typeof edge.after === "string" &&
            events.includes(edge.before) &&
            events.includes(edge.after)
          )
            constraints.connections.push({
              before: edge.before,
              after: edge.after,
            });
        }
    }
    const positions = { ...fallback.positions };
    if (saved.positions && typeof saved.positions === "object")
      for (const [event, point] of Object.entries(saved.positions)) {
        if (
          events.includes(event) &&
          point &&
          typeof point === "object" &&
          "x" in point &&
          "y" in point &&
          typeof point.x === "number" &&
          typeof point.y === "number" &&
          Number.isFinite(point.x) &&
          Number.isFinite(point.y)
        ) {
          positions[event] = {
            x: Math.max(24, Math.min(10000, point.x)),
            y: Math.max(24, Math.min(10000, point.y)),
          };
        }
      }
    return {
      order: resolveEventOrder(order, constraints),
      constraints,
      positions,
    };
  } catch {
    return fallback;
  }
}
export function saveOrderEditorState(meetId: string, state: OrderEditorState) {
  if (typeof window === "undefined")
    throw new Error("Save the program from a browser.");
  if (!isEventOrderValid(state.order, state.constraints))
    throw new Error("Resolve the arrows and locks before saving the program.");
  window.localStorage.setItem(
    key(meetId),
    JSON.stringify({
      constraints: state.constraints,
      positions: state.positions,
    }),
  );
  if (!saveProgramEventOrder(meetId, state.order))
    throw new Error(
      "Could not save this order. Check that browser storage is available.",
    );
}
