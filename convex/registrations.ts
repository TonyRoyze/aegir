import {
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { registrationSnapshot } from "../lib/registration-snapshot";
import { v } from "convex/values";
import {
  configuration,
  ensureConfiguration,
  findEvent,
  meetRegistrations,
  registrationEvents,
  registrationTeam,
  MAX_REGISTRATIONS,
} from "./meetConfiguration";
import { teamLabel } from "../lib/meet-configuration";

async function readRegistrations(
  ctx: QueryCtx | MutationCtx,
  meetId?: Id<"meets">,
) {
  const regs = meetId
    ? await meetRegistrations(ctx, meetId)
    : await ctx.db.query("registrations").take(MAX_REGISTRATIONS);
  const config = meetId
    ? await configuration(ctx, meetId)
    : { teams: [], events: [] };
  const rows = [];
  for (const reg of regs) {
    const student = await ctx.db.get(reg.studentId);
    if (!student) continue;
    const team = registrationTeam(reg, student, config.teams);
    rows.push({
      id: reg.externalId,
      teamId: team?._id ?? reg.teamId,
      teamName: team?.code,
      meetEventIds: reg.meetEventIds,
      student: {
        id: student.externalId,
        name: student.name,
        registrationNumber: student.registrationNumber,
        nameInUse: student.nameInUse,
        gender: student.gender,
        teamId: team?._id ?? reg.teamId,
        faculty: team ? teamLabel(team) : student.faculty,
        seed: student.seed,
      },
      events: registrationEvents(reg, config.events),
      registeredAt: reg.registeredAt,
    });
  }
  return rows;
}
export const get = query({
  args: { meetId: v.optional(v.id("meets")) },
  handler: (ctx, args) => readRegistrations(ctx, args.meetId),
});
export const sync = mutation({
  args: {
    meetId: v.id("meets"),
    expectedSnapshot: v.optional(v.string()),
    registrations: v.array(
      v.object({
        id: v.string(),
        teamId: v.optional(v.id("meetTeams")),
        student: v.object({
          id: v.string(),
          name: v.string(),
          registrationNumber: v.string(),
          nameInUse: v.string(),
          gender: v.optional(v.union(v.literal("Male"), v.literal("Female"))),
          faculty: v.optional(v.string()),
          seed: v.optional(v.union(v.number(), v.string())),
        }),
        events: v.array(v.string()),
        registeredAt: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (args.registrations.length > MAX_REGISTRATIONS)
      throw new Error("A meet supports up to 1,000 registrations.");
    if (
      args.expectedSnapshot !== undefined &&
      args.expectedSnapshot !==
        registrationSnapshot(await readRegistrations(ctx, args.meetId))
    ) {
      throw new Error(
        "Registrations changed since you loaded them. Your edits were kept; reload the latest registrations before retrying.",
      );
    }
    const config = await ensureConfiguration(ctx, args.meetId);
    const current = await meetRegistrations(ctx, args.meetId);
    const byExternalId = new Map(current.map((r) => [r.externalId, r]));
    const incoming = new Set<string>();
    for (const reg of args.registrations) {
      if (incoming.has(reg.id)) throw new Error("Duplicate registration ID.");
      incoming.add(reg.id);
      const existing = byExternalId.get(reg.id);
      const selectedTeamId = reg.teamId ?? existing?.teamId;
      const team = selectedTeamId
        ? config.teams.find((t) => t._id === selectedTeamId)
        : config.teams.find(
            (t) =>
              teamLabel(t) === reg.student.faculty ||
              t.code === reg.student.faculty,
          );
      if (!team) throw new Error("Choose a team configured for this meet.");
      const eventIds = [...new Set(reg.events)].map((label) => {
        const event = findEvent(config.events, label);
        if (!event)
          throw new Error(`Event "${label}" is not configured for this meet.`);
        if (
          event.gender !== "Mixed" &&
          event.gender !== undefined &&
          event.gender !== reg.student.gender
        )
          throw new Error(
            "A swimmer cannot enter an event for a different gender.",
          );
        return event._id;
      });
      const student = await ctx.db
        .query("students")
        .withIndex("by_externalId", (q) => q.eq("externalId", reg.student.id))
        .unique();
      const studentFields = {
        name: reg.student.name,
        registrationNumber: reg.student.registrationNumber,
        nameInUse: reg.student.nameInUse,
        gender: reg.student.gender,
        seed: reg.student.seed ? Number(reg.student.seed) : undefined,
      };
      if (
        studentFields.seed !== undefined &&
        (!Number.isFinite(studentFields.seed) || studentFields.seed < 0)
      )
        throw new Error("Seed must be a non-negative number.");
      // Team selection never patches a student's global faculty.
      const studentId =
        student?._id ??
        (await ctx.db.insert("students", {
          externalId: reg.student.id,
          ...studentFields,
        }));
      if (student) await ctx.db.patch(studentId, studentFields);
      const fields = {
        externalId: reg.id,
        studentId,
        meetId: args.meetId,
        teamId: team._id,
        meetEventIds: eventIds,
        events: reg.events,
        registeredAt: reg.registeredAt,
      };
      if (existing) await ctx.db.patch(existing._id, fields);
      else await ctx.db.insert("registrations", fields);
    }
    for (const reg of current)
      if (!incoming.has(reg.externalId)) {
        const student = await ctx.db.get(reg.studentId);
        if (
          student &&
          (await ctx.db
            .query("results")
            .withIndex("by_meet_student", (q) =>
              q.eq("meetId", args.meetId).eq("studentId", student.externalId),
            )
            .first())
        )
          throw new Error(
            "A swimmer with recorded results cannot be removed. Remove those results first.",
          );
        await ctx.db.delete(reg._id);
      }
    return await readRegistrations(ctx, args.meetId);
  },
});
