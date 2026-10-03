export interface SeededParticipant {
  name?: string;
  seed?: number;
}

export const LANES_PER_HEAT = 6;
export const DEFAULT_LANE_ORDER = [3, 4, 2, 5, 1, 6];

export function displayFaculty(faculty: string | null | undefined): string {
  if (!faculty) return "";
  return faculty;
}

function sortBySeedDesc<T extends SeededParticipant>(students: T[]): T[] {
  return [...students].sort((a, b) => {
    const seedA = a.seed ?? 0;
    const seedB = b.seed ?? 0;
    if (seedB !== seedA) {
      return seedB - seedA;
    }

    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
}

/**
 * Splits a list of students into balanced heats and assigns lanes based on priority.
 *
 * @param students List of students to assign
 * @param lanesPerHeat Maximum lanes available (usually 6)
 * @param laneOrder The order in which lanes should be filled (1-based)
 * @param sortBySeed If true, sorts students by seed (descending) before lane assignment
 * @returns Array of heats, where each heat is an array of students indexed by lane (0-based)
 */
export function assignToHeats<T extends SeededParticipant>(
  students: T[],
  lanesPerHeat: number = LANES_PER_HEAT,
  laneOrder: number[] = DEFAULT_LANE_ORDER,
  sortBySeed: boolean = true,
): (T | null)[][] {
  const sortedStudents = sortBySeed ? sortBySeedDesc(students) : students;
  const n = sortedStudents.length;
  if (n === 0) return [new Array(lanesPerHeat).fill(null)];

  const numHeats = Math.ceil(n / lanesPerHeat);
  const basePerHeat = Math.floor(n / numHeats);
  const remainder = n % numHeats;

  const heats: (T | null)[][] = [];
  let studentIdx = 0;

  for (let h = 0; h < numHeats; h++) {
    const swimmersInThisHeat = basePerHeat + (h < remainder ? 1 : 0);
    const heatSwimmers = sortedStudents.slice(
      studentIdx,
      studentIdx + swimmersInThisHeat,
    );
    studentIdx += swimmersInThisHeat;

    const heatWithLanes = new Array<T | null>(lanesPerHeat).fill(null);
    heatSwimmers.forEach((s, i) => {
      const laneNumber = laneOrder[i];
      if (laneNumber && laneNumber <= lanesPerHeat) {
        heatWithLanes[laneNumber - 1] = s;
      }
    });
    heats.push(heatWithLanes);
  }

  return heats;
}
