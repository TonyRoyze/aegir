export function preferredMeetId<T extends { _id: string; status?: string }>(
  meets: readonly T[] | undefined,
  selected?: string | null,
): string | null {
  if (selected && meets?.some((meet) => meet._id === selected)) return selected;
  return (
    meets?.find((meet) => meet.status === "active")?._id ??
    meets?.[0]?._id ??
    null
  );
}
