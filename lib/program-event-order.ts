export const PROGRAM_ORDER_CHANGED = "aegir-program-order-changed";

const PROGRAM_EVENT_ORDER_PREFIX = "aegir-program-event-order:";

function getStorageKey(meetId: string): string {
  return `${PROGRAM_EVENT_ORDER_PREFIX}${meetId}`;
}

export function normalizeProgramEventOrder(
  baseEvents: string[],
  candidateOrder: string[] | null | undefined,
): string[] {
  if (!candidateOrder || candidateOrder.length === 0) {
    return [...baseEvents];
  }

  const baseEventSet = new Set(baseEvents);
  const normalized = [
    ...new Set(candidateOrder.filter((event) => baseEventSet.has(event))),
  ];
  const normalizedSet = new Set(normalized);

  for (const event of baseEvents) {
    if (!normalizedSet.has(event)) {
      normalized.push(event);
    }
  }

  return normalized;
}

export function loadProgramEventOrder(
  meetId: string,
  baseEvents: string[],
): string[] {
  if (typeof window === "undefined") {
    return [...baseEvents];
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(meetId));
    if (!raw) {
      return [...baseEvents];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...baseEvents];
    }

    return normalizeProgramEventOrder(
      baseEvents,
      parsed.filter((value): value is string => typeof value === "string"),
    );
  } catch (error) {
    console.error("Failed to load program event order", error);
    return [...baseEvents];
  }
}

export function saveProgramEventOrder(
  meetId: string,
  orderedEvents: string[],
): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(
      getStorageKey(meetId),
      JSON.stringify(orderedEvents),
    );
    window.dispatchEvent(new Event(PROGRAM_ORDER_CHANGED));
    return true;
  } catch (error) {
    console.error("Failed to save program event order", error);
    return false;
  }
}

export function clearProgramEventOrder(meetId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(getStorageKey(meetId));
    window.dispatchEvent(new Event(PROGRAM_ORDER_CHANGED));
  } catch (error) {
    console.error("Failed to clear program event order", error);
  }
}

export function readProgramEventOrderSnapshot(
  meetId: string | null,
): string | null {
  if (!meetId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(getStorageKey(meetId));
  } catch {
    return null;
  }
}
