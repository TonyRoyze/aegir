/** Stable serialization of the editable contract; omit backend projection metadata. */
export function registrationSnapshot(
  rows: readonly {
    id: string;
    teamId?: string;
    student: {
      id: string;
      name: string;
      registrationNumber: string;
      nameInUse: string;
      gender?: string;
      faculty?: string;
      seed?: number | string;
    };
    events: string[];
    registeredAt: string | Date;
  }[],
): string {
  return JSON.stringify(
    [...rows]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((row) => ({
        id: row.id,
        teamId: row.teamId ?? null,
        student: {
          id: row.student.id,
          name: row.student.name,
          registrationNumber: row.student.registrationNumber,
          nameInUse: row.student.nameInUse,
          gender: row.student.gender ?? null,
          faculty: row.student.faculty ?? null,
          seed:
            row.student.seed == null || row.student.seed === ""
              ? null
              : Number(row.student.seed),
        },
        events: [...row.events].sort(),
        registeredAt:
          row.registeredAt instanceof Date
            ? row.registeredAt.toISOString()
            : row.registeredAt,
      })),
  );
}
