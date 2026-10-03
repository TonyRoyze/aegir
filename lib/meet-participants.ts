import type { MeetProgramStudent } from "./meet-program-pdf";

/** Preserve first-member seed only for the public heat view's existing policy. */
export function relayTeams(
  students: readonly MeetProgramStudent[],
  preserveSeed = false,
): MeetProgramStudent[] {
  const teams = new Map<string, MeetProgramStudent>();
  for (const student of students) {
    const faculty = student.faculty || "Unknown";
    const key = student.teamId || faculty;
    if (!teams.has(key))
      teams.set(key, {
        _id: key,
        id: key,
        teamId: student.teamId,
        name: faculty,
        nameInUse: faculty,
        faculty,
        gender: student.gender,
        isRelay: true,
        ...(preserveSeed ? { seed: student.seed } : {}),
      });
  }
  return Array.from(teams.values());
}
