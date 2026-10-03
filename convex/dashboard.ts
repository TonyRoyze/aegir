import { query } from "./_generated/server";
import { v } from "convex/values";
import { projectResults } from "./resultHelpers";
import { meetRegistrations } from "./meetConfiguration";

function leaders(results: Awaited<ReturnType<typeof projectResults>>) {
  const teams = new Map<string, number>();
  const male = new Map<string, number>();
  const female = new Map<string, number>();
  const swimmers = new Map<
    string,
    { id: string; name: string; faculty: string; score: number }
  >();
  for (const result of results) {
    if (!result.points || result.points <= 0) continue;
    const team = result.teamName || "Unknown";
    teams.set(team, (teams.get(team) ?? 0) + result.points);
    const gender = result.event.startsWith("M:")
      ? "Male"
      : result.event.startsWith("W:")
        ? "Female"
        : result.student?.gender;
    const group =
      gender === "Male" ? male : gender === "Female" ? female : null;
    if (group) group.set(team, (group.get(team) ?? 0) + result.points);
    if (result.student && !result.event.toLowerCase().includes("relay")) {
      const id = result.student.externalId;
      const swimmer = swimmers.get(id) ?? {
        id,
        name: result.student.name,
        faculty: team,
        score: 0,
      };
      swimmer.score += result.points;
      swimmers.set(id, swimmer);
    }
  }
  const sorted = (map: Map<string, number>) =>
    [...map]
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score);
  return {
    facultyLeaderboard: sorted(teams),
    facultyLeaderboardMale: sorted(male),
    facultyLeaderboardFemale: sorted(female),
    studentLeaderboard: [...swimmers.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10),
  };
}
export const getPublicLeaderboard = query({
  args: { meetId: v.id("meets") },
  handler: async (ctx, args) => {
    const meet = await ctx.db.get(args.meetId);
    return {
      meetName: meet?.name ?? "",
      meetDate: meet?.date ?? "",
      ...leaders(meet ? await projectResults(ctx, args.meetId) : []),
    };
  },
});
export const getStats = query({
  args: { meetId: v.id("meets") },
  handler: async (ctx, args) => {
    const meet = await ctx.db.get(args.meetId);
    if (!meet) return { totalParticipants: 0, totalEntries: 0, ...leaders([]) };
    const regs = await meetRegistrations(ctx, args.meetId);
    return {
      totalParticipants: new Set(regs.map((r) => r.studentId)).size,
      totalEntries: regs.reduce(
        (sum, r) => sum + (r.meetEventIds ?? r.events).length,
        0,
      ),
      ...leaders(await projectResults(ctx, args.meetId)),
    };
  },
});
