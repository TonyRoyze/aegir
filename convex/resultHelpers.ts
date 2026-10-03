import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import {
  configuration,
  findEvent,
  meetRegistrations,
  registrationTeam,
  MAX_RESULTS,
} from "./meetConfiguration";
import { eventLabel, teamLabel } from "../lib/meet-configuration";

export async function projectResults(
  ctx: QueryCtx | MutationCtx,
  meetId: Id<"meets">,
  onlyEventId?: Id<"meetEvents">,
  legacyEvent?: string,
) {
  const config = await configuration(ctx, meetId);
  const rows = await ctx.db
    .query("results")
    .withIndex("by_meet_event", (q) => q.eq("meetId", meetId))
    .take(MAX_RESULTS + 1);
  if (rows.length > MAX_RESULTS)
    throw new Error("Meet results exceed the supported size.");
  const selectedEventId =
    onlyEventId ??
    (legacyEvent ? findEvent(config.events, legacyEvent)?._id : undefined);
  const regs = await meetRegistrations(ctx, meetId);
  const students = new Map<string, Doc<"students">>();
  const teams = new Map<string, Doc<"meetTeams">>();
  for (const reg of regs) {
    const student = await ctx.db.get(reg.studentId);
    if (student) {
      students.set(student.externalId, student);
      const team = registrationTeam(reg, student, config.teams);
      if (team) teams.set(student.externalId, team);
    }
  }
  return await Promise.all(
    rows
      .filter((row) => {
        if (!onlyEventId && !legacyEvent) return true;
        if (selectedEventId)
          return (
            (row.meetEventId ?? findEvent(config.events, row.event)?._id) ===
            selectedEventId
          );
        return !row.meetEventId && row.event === legacyEvent;
      })
      .map(async (row) => {
        const event = row.meetEventId
          ? config.events.find((e) => e._id === row.meetEventId)
          : findEvent(config.events, row.event);
        const relay = (event?.stroke ?? row.event)
          .toLowerCase()
          .includes("relay");
        const team = row.teamId
          ? config.teams.find((t) => t._id === row.teamId)
          : relay
            ? config.teams.find(
                (t) =>
                  t._id === row.studentId ||
                  t.code === row.studentId ||
                  teamLabel(t) === row.studentId,
              )
            : teams.get(row.studentId);
        const student =
          students.get(row.studentId) ??
          (await ctx.db
            .query("students")
            .withIndex("by_externalId", (q) =>
              q.eq("externalId", row.studentId),
            )
            .unique());
        return {
          ...row,
          event: event ? eventLabel(event) : row.event,
          meetEventId: event?._id ?? row.meetEventId,
          studentId: relay && team ? team._id : row.studentId,
          teamId: team?._id,
          teamName: team
            ? teamLabel(team)
            : (student?.faculty ?? (relay ? row.studentId : undefined)),
          student: student
            ? { ...student, faculty: team ? teamLabel(team) : student.faculty }
            : null,
        };
      }),
  );
}
