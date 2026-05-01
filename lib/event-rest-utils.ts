export interface RestStudentRef {
  id: string;
  name: string;
}

export interface EventRestSummary {
  eventName: string;
  sharedWithPrevious: number;
  sharedWithNext: number;
  previousEventName: string | null;
  nextEventName: string | null;
  previousSharedNames: string[];
  nextSharedNames: string[];
}

export interface EventRestConflictMap {
  [eventName: string]: Set<string>; // student keys that are in conflict with adjacent events
}

export function buildConflictMap(
  registrations: RegistrationLike[],
  orderedEvents: string[],
): EventRestConflictMap {
  const participantsByEvent = buildEventParticipants(registrations, orderedEvents);
  const conflictMap: EventRestConflictMap = {};

  orderedEvents.forEach((eventName, index) => {
    const prevEvent = index > 0 ? orderedEvents[index - 1] : null;
    const nextEvent = index < orderedEvents.length - 1 ? orderedEvents[index + 1] : null;
    const conflictIds = new Set<string>();

    if (prevEvent) {
      const prevParticipants = participantsByEvent.get(prevEvent);
      const currentParticipants = participantsByEvent.get(eventName);
      if (prevParticipants && currentParticipants) {
        prevParticipants.forEach((_, id) => {
          if (currentParticipants.has(id)) conflictIds.add(id);
        });
      }
    }

    if (nextEvent) {
      const nextParticipants = participantsByEvent.get(nextEvent);
      const currentParticipants = participantsByEvent.get(eventName);
      if (nextParticipants && currentParticipants) {
        nextParticipants.forEach((_, id) => {
          if (currentParticipants.has(id)) conflictIds.add(id);
        });
      }
    }

    if (conflictIds.size > 0) {
      conflictMap[eventName] = conflictIds;
    }
  });

  return conflictMap;
}

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

function getStudentKey(registration: RegistrationLike, index: number): string {
  return (
    registration.student?._id ||
    registration.student?.id ||
    registration.student?.registrationNumber ||
    registration.id ||
    `${registration.student?.name || "student"}-${index}`
  );
}

function getStudentName(registration: RegistrationLike, index: number): string {
  return registration.student?.name || registration.student?.registrationNumber || `Student ${index + 1}`;
}

function buildEventParticipants(
  registrations: RegistrationLike[],
  orderedEvents: string[],
): Map<string, Map<string, string>> {
  const participantsByEvent = new Map<string, Map<string, string>>();

  orderedEvents.forEach((eventName) => {
    participantsByEvent.set(eventName, new Map());
  });

  registrations.forEach((registration, index) => {
    const studentKey = getStudentKey(registration, index);
    const studentName = getStudentName(registration, index);

    registration.events.forEach((eventName) => {
      const eventParticipants = participantsByEvent.get(eventName);
      if (eventParticipants) {
        eventParticipants.set(studentKey, studentName);
      }
    });
  });

  return participantsByEvent;
}

function getSharedStudents(
  left: Map<string, string> | undefined,
  right: Map<string, string> | undefined,
): RestStudentRef[] {
  if (!left || !right) {
    return [];
  }

  const shared: RestStudentRef[] = [];
  left.forEach((name, id) => {
    if (right.has(id)) {
      shared.push({ id, name });
    }
  });

  shared.sort((a, b) => a.name.localeCompare(b.name));
  return shared;
}

function scoreOrder(
  orderedEvents: string[],
  participantsByEvent: Map<string, Map<string, string>>,
): number {
  let penalty = 0;

  for (let i = 0; i < orderedEvents.length; i += 1) {
    for (let j = i + 1; j < orderedEvents.length; j += 1) {
      const sharedCount = getSharedStudents(
        participantsByEvent.get(orderedEvents[i]),
        participantsByEvent.get(orderedEvents[j]),
      ).length;

      if (!sharedCount) {
        continue;
      }

      const distance = j - i;
      penalty += sharedCount * (100 / (distance * distance));
    }
  }

  return penalty;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function summarizeEventRest(
  registrations: RegistrationLike[],
  orderedEvents: string[],
): EventRestSummary[] {
  const participantsByEvent = buildEventParticipants(registrations, orderedEvents);

  return orderedEvents.map((eventName, index) => {
    const previousEventName = index > 0 ? orderedEvents[index - 1] : null;
    const nextEventName = index < orderedEvents.length - 1 ? orderedEvents[index + 1] : null;

    const previousShared = previousEventName
      ? getSharedStudents(
          participantsByEvent.get(eventName),
          participantsByEvent.get(previousEventName),
        )
      : [];

    const nextShared = nextEventName
      ? getSharedStudents(
          participantsByEvent.get(eventName),
          participantsByEvent.get(nextEventName),
        )
      : [];

    return {
      eventName,
      sharedWithPrevious: previousShared.length,
      sharedWithNext: nextShared.length,
      previousEventName,
      nextEventName,
      previousSharedNames: previousShared.map((student) => student.name),
      nextSharedNames: nextShared.map((student) => student.name),
    };
  });
}

export function optimizeEventOrderForRest(
  registrations: RegistrationLike[],
  orderedEvents: string[],
): string[] {
  if (orderedEvents.length <= 2) {
    return orderedEvents;
  }

  const participantsByEvent = buildEventParticipants(registrations, orderedEvents);

  let bestOrder = [...orderedEvents];
  let bestScore = scoreOrder(bestOrder, participantsByEvent);
  let improved = true;
  let guard = 0;

  while (improved && guard < orderedEvents.length * 4) {
    improved = false;
    guard += 1;

    for (let fromIndex = 0; fromIndex < bestOrder.length; fromIndex += 1) {
      for (let toIndex = 0; toIndex < bestOrder.length; toIndex += 1) {
        if (fromIndex === toIndex) {
          continue;
        }

        const candidateOrder = moveItem(bestOrder, fromIndex, toIndex);
        const candidateScore = scoreOrder(candidateOrder, participantsByEvent);

        if (candidateScore < bestScore) {
          bestOrder = candidateOrder;
          bestScore = candidateScore;
          improved = true;
        }
      }
    }
  }

  return bestOrder;
}
