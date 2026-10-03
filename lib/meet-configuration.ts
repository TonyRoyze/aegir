export type EventGender = "Male" | "Female" | "Mixed";
export interface EventInput {
  id?: string;
  distance: number;
  stroke: string;
  gender?: EventGender;
  legs?: number;
  legacyLabel?: string;
}
export interface TeamInput {
  id?: string;
  code: string;
  legacyCode?: string;
}
export const STROKES = [
  "Freestyle",
  "Backstroke",
  "Breaststroke",
  "Butterfly",
  "Individual Medley",
  "Freestyle Relay",
  "Medley Relay",
];
export const MAX_MEET_ITEMS = 100;
export function eventLabel(event: EventInput) {
  const prefix =
    event.gender === "Male" ? "M:" : event.gender === "Female" ? "W:" : "";
  return `${prefix}${event.legs && event.legs > 1 ? `${event.legs}x` : ""}${event.distance}m ${event.stroke.trim()}`;
}
export function readableEventLabel(event: EventInput) {
  return `${event.legs && event.legs > 1 ? `${event.legs} × ` : ""}${event.distance} m ${event.stroke} — ${event.gender === "Male" ? "Men" : event.gender === "Female" ? "Women" : "Mixed"}`;
}
export function parseLegacyEvent(label: string): EventInput {
  const match = label.match(
    /^\s*(?:([MW]):\s*)?(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*m\s+(.+?)\s*$/i,
  );
  if (!match)
    throw new Error(
      `Cannot convert event "${label}". Use a distance and stroke before saving this meet.`,
    );
  return {
    distance: Number(match[3]),
    stroke: match[4],
    gender:
      match[1]?.toUpperCase() === "M"
        ? "Male"
        : match[1]?.toUpperCase() === "W"
          ? "Female"
          : "Mixed",
    ...(match[2] ? { legs: Number(match[2]) } : {}),
    legacyLabel: label,
  };
}
// Older deployments may still return a name without a code. Read it as a
// legacy code at the boundary; new configuration still stores only code.
export function teamLabel(team: unknown): string {
  if (!team || typeof team !== "object") return "";
  const value = team as { code?: unknown; name?: unknown };
  if (typeof value.code === "string") return value.code.trim();
  return typeof value.name === "string" ? value.name.trim() : "";
}
export function normalizeTeam(team: unknown): TeamInput {
  const value = (team && typeof team === "object" ? team : {}) as {
    id?: unknown;
    legacyCode?: unknown;
    legacyName?: unknown;
    name?: unknown;
  };
  const legacyCode = value.legacyCode ?? value.legacyName ?? value.name;
  return {
    code: teamLabel(team),
    ...(typeof value.id === "string" ? { id: value.id } : {}),
    ...(typeof legacyCode === "string" ? { legacyCode } : {}),
  };
}
export function validateConfiguration(
  teams: TeamInput[],
  events: EventInput[],
) {
  if (teams.length > MAX_MEET_ITEMS || events.length > MAX_MEET_ITEMS)
    throw new Error(
      `A meet supports up to ${MAX_MEET_ITEMS} teams and events.`,
    );
  const codes = new Set<string>();
  for (const team of teams) {
    if (typeof team.code !== "string")
      throw new Error(
        "A team code is required. Update this team before saving.",
      );
    const code = team.code.trim().toLowerCase();
    if (!code || team.code.length > 150)
      throw new Error("Team codes must contain 1–150 characters.");
    if (codes.has(code))
      throw new Error("Team codes must be unique within the meet.");
    codes.add(code);
  }
  const keys = new Set<string>();
  for (const event of events) {
    if (!Number.isFinite(event.distance) || event.distance <= 0)
      throw new Error("Event distances must be positive numbers.");
    if (!event.stroke.trim() || event.stroke.length > 100)
      throw new Error("A stroke is required (up to 100 characters).");
    if (
      event.legs !== undefined &&
      (!Number.isInteger(event.legs) || event.legs < 1 || event.legs > 20)
    )
      throw new Error("Relay legs must be a whole number from 1 to 20.");
    const key = eventLabel(event).toLowerCase();
    if (keys.has(key)) throw new Error("Duplicate events are not allowed.");
    keys.add(key);
  }
}
