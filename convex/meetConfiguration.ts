import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  eventLabel,
  parseLegacyEvent,
  teamLabel,
  validateConfiguration,
  type EventInput,
  type TeamInput,
  MAX_MEET_ITEMS,
} from "../lib/meet-configuration";

export const teamValidator = v.object({
  id: v.optional(v.id("meetTeams")),
  code: v.string(),
  legacyCode: v.optional(v.string()),
});
export const eventValidator = v.object({
  id: v.optional(v.id("meetEvents")),
  distance: v.number(),
  stroke: v.string(),
  gender: v.optional(
    v.union(v.literal("Male"), v.literal("Female"), v.literal("Mixed")),
  ),
  legs: v.optional(v.number()),
  legacyLabel: v.optional(v.string()),
});
export const MAX_REGISTRATIONS = 1000;
export const MAX_RESULTS = 5000;
type Ctx = QueryCtx | MutationCtx;

export async function configuration(ctx: Ctx, meetId: Id<"meets">) {
  const [teams, events] = await Promise.all([
    ctx.db
      .query("meetTeams")
      .withIndex("by_meetId", (q) => q.eq("meetId", meetId))
      .take(MAX_MEET_ITEMS + 1),
    ctx.db
      .query("meetEvents")
      .withIndex("by_meetId", (q) => q.eq("meetId", meetId))
      .take(MAX_MEET_ITEMS + 1),
  ]);
  if (teams.length > MAX_MEET_ITEMS || events.length > MAX_MEET_ITEMS)
    throw new Error("Meet configuration exceeds the supported size.");
  return {
    teams: teams.sort((a, b) => a.order - b.order),
    events: events.sort((a, b) => a.order - b.order),
  };
}
export async function meetRegistrations(ctx: Ctx, meetId: Id<"meets">) {
  const rows = await ctx.db
    .query("registrations")
    .withIndex("by_meetId", (q) => q.eq("meetId", meetId))
    .take(MAX_REGISTRATIONS + 1);
  if (rows.length > MAX_REGISTRATIONS)
    throw new Error(
      "This meet exceeds 1,000 registrations. Use a batched workflow for this meet.",
    );
  return rows;
}
export function findEvent(events: Doc<"meetEvents">[], label: string) {
  return (
    events.find((e) => eventLabel(e) === label) ??
    events.find((e) => e.legacyLabel === label)
  );
}
export function registrationEvents(
  reg: Doc<"registrations">,
  events: Doc<"meetEvents">[],
) {
  if (reg.meetEventIds !== undefined)
    return reg.meetEventIds
      .map((id) => events.find((e) => e._id === id))
      .filter((e): e is Doc<"meetEvents"> => !!e)
      .map(eventLabel);
  return reg.events.map((label) => {
    const event = findEvent(events, label);
    return event ? eventLabel(event) : label;
  });
}
export function registrationTeam(
  reg: Doc<"registrations">,
  student: Doc<"students">,
  teams: Doc<"meetTeams">[],
) {
  return reg.teamId
    ? teams.find((t) => t._id === reg.teamId)
    : teams.find(
        (t) => t.code === student.faculty || teamLabel(t) === student.faculty,
      );
}
export async function projectMeet(ctx: Ctx, meet: Doc<"meets">) {
  const config = await configuration(ctx, meet._id);
  let teams: TeamInput[] = config.teams.map((t) => ({
    id: t._id,
    code: t.code,
  }));
  if (meet.configurationVersion === undefined) {
    const regs = await meetRegistrations(ctx, meet._id);
    const names = new Set<string>();
    for (const reg of regs) {
      const student = await ctx.db.get(reg.studentId);
      if (student?.faculty) names.add(student.faculty);
    }
    teams = [...names].sort().map((name) => ({ code: name, legacyCode: name }));
  }
  // Old strings stay available as a presentation adapter for existing UI/PDFs.
  return {
    ...meet,
    teams,
    configuredEvents:
      config.events.length || meet.configurationVersion !== undefined
        ? config.events.map((e) => ({
            id: e._id,
            distance: e.distance,
            stroke: e.stroke,
            gender: e.gender,
            legs: e.legs,
            legacyLabel: e.legacyLabel,
          }))
        : meet.events.map(parseLegacyEvent),
    events:
      meet.configurationVersion !== undefined
        ? config.events.map(eventLabel)
        : meet.events,
  };
}

export async function ensureConfiguration(
  ctx: MutationCtx,
  meetId: Id<"meets">,
) {
  const meet = await ctx.db.get(meetId);
  if (!meet) throw new Error("Meet not found.");
  if (meet.configurationVersion !== undefined)
    return configuration(ctx, meetId);
  const parsed = meet.events.map(parseLegacyEvent);
  const regs = await meetRegistrations(ctx, meetId);
  const names = new Set<string>();
  for (const reg of regs) {
    const student = await ctx.db.get(reg.studentId);
    if (student?.faculty) names.add(student.faculty);
  }
  validateConfiguration(
    [...names].map((name) => ({ code: name })),
    parsed,
  );
  const existing = await configuration(ctx, meetId);
  for (const [order, event] of parsed.entries())
    if (!findEvent(existing.events, event.legacyLabel!)) {
      await ctx.db.insert("meetEvents", { ...event, meetId, order });
    }
  for (const [order, name] of [...names].sort().entries())
    if (!existing.teams.some((t) => t.code === name)) {
      await ctx.db.insert("meetTeams", { meetId, code: name, order });
    }
  await ctx.db.patch(meetId, { configurationVersion: 1 });
  return configuration(ctx, meetId);
}

export async function migrateRegistration(
  ctx: MutationCtx,
  reg: Doc<"registrations">,
  config?: Awaited<ReturnType<typeof configuration>>,
) {
  if (!reg.meetId) return;
  const { teams, events } =
    config ?? (await ensureConfiguration(ctx, reg.meetId));
  const student = await ctx.db.get(reg.studentId);
  const team = student && registrationTeam(reg, student, teams);
  const ids =
    reg.meetEventIds ??
    reg.events.map((label) => {
      const event = findEvent(events, label);
      if (!event)
        throw new Error(
          `Unknown legacy event "${label}" in registration ${reg.externalId}.`,
        );
      return event._id;
    });
  if (reg.meetEventIds !== undefined && (reg.teamId || !team)) return;
  await ctx.db.patch(reg._id, {
    ...(reg.meetEventIds === undefined ? { meetEventIds: ids } : {}),
    ...(!reg.teamId && team ? { teamId: team._id } : {}),
  });
}

export async function saveConfiguration(
  ctx: MutationCtx,
  meetId: Id<"meets">,
  teams: TeamInput[],
  events: EventInput[],
  pointOverrides?: Record<string, number[]>,
) {
  validateConfiguration(teams, events);
  const before = await ensureConfiguration(ctx, meetId);
  const regs = await meetRegistrations(ctx, meetId);
  // Backfill dependencies before labels or team codes can change.
  for (const reg of regs) await migrateRegistration(ctx, reg, before);
  const results = await ctx.db
    .query("results")
    .withIndex("by_meet_event", (q) => q.eq("meetId", meetId))
    .take(MAX_RESULTS + 1);
  const heats = await ctx.db
    .query("heatAssignments")
    .withIndex("by_meet_event_gender_heat", (q) => q.eq("meetId", meetId))
    .take(MAX_RESULTS + 1);
  if (results.length > MAX_RESULTS || heats.length > MAX_RESULTS)
    throw new Error(
      "This meet requires a batched migration before editing configuration.",
    );
  for (const result of results) {
    const event = findEvent(before.events, result.event);
    const team = before.teams.find(
      (t) => t.code === result.studentId || teamLabel(t) === result.studentId,
    );
    if (!result.meetEventId && event)
      await ctx.db.patch(result._id, {
        meetEventId: event._id,
        ...(event.stroke.toLowerCase().includes("relay") && team
          ? { teamId: team._id }
          : {}),
      });
  }
  for (const heat of heats) {
    const event = findEvent(before.events, heat.event);
    if (!heat.meetEventId && event)
      await ctx.db.patch(heat._id, { meetEventId: event._id });
  }

  const meet = await ctx.db.get(meetId);
  const overrides = pointOverrides ?? meet?.eventPointSystems ?? {};
  const savedPoints: Record<string, number[]> = {};
  const savedTeamIds = new Set<Id<"meetTeams">>();
  const savedEventIds = new Set<Id<"meetEvents">>();
  for (const [order, input] of teams.entries()) {
    const existing = input.id
      ? before.teams.find((t) => t._id === input.id)
      : before.teams.find((t) => t.code === (input.legacyCode ?? input.code));
    if (input.id && !existing)
      throw new Error("A team does not belong to this meet.");
    const fields = {
      meetId,
      code: input.code.trim(),
      order,
    };
    const id = existing?._id ?? (await ctx.db.insert("meetTeams", fields));
    if (savedTeamIds.has(id)) throw new Error("Duplicate team ID.");
    if (existing) await ctx.db.patch(id, fields);
    savedTeamIds.add(id);
  }
  for (const [order, input] of events.entries()) {
    const existing = input.id
      ? before.events.find((e) => e._id === input.id)
      : input.legacyLabel
        ? findEvent(before.events, input.legacyLabel)
        : undefined;
    if (input.id && !existing)
      throw new Error("An event does not belong to this meet.");
    const fields = {
      meetId,
      distance: input.distance,
      stroke: input.stroke.trim(),
      gender: input.gender,
      legs: input.legs,
      legacyLabel: existing?.legacyLabel ?? input.legacyLabel,
      order,
    };
    const id = existing?._id ?? (await ctx.db.insert("meetEvents", fields));
    if (savedEventIds.has(id)) throw new Error("Duplicate event ID.");
    if (existing) {
      for (const reg of regs.filter(
        (r) =>
          r.meetEventIds?.includes(id) ||
          r.events.some((label) => findEvent(before.events, label)?._id === id),
      )) {
        const student = await ctx.db.get(reg.studentId);
        if (
          input.gender &&
          input.gender !== "Mixed" &&
          student?.gender !== input.gender
        )
          throw new Error(
            "The new event gender conflicts with an existing entry.",
          );
      }
      await ctx.db.patch(id, fields);
    }
    const baseLabel = `${input.legs && input.legs > 1 ? `${input.legs}x` : ""}${input.distance}m ${input.stroke}`;
    const points =
      overrides[id] ??
      overrides[eventLabel(input)] ??
      overrides[existing ? eventLabel(existing) : ""] ??
      overrides[existing?.legacyLabel ?? input.legacyLabel ?? ""] ??
      overrides[baseLabel];
    if (points) {
      if (points.some((p) => !Number.isFinite(p) || p < 0))
        throw new Error("Points must be non-negative numbers.");
      savedPoints[id] = points;
    }
    savedEventIds.add(id);
  }
  const updatedRegs = await meetRegistrations(ctx, meetId);
  for (const team of before.teams)
    if (!savedTeamIds.has(team._id)) {
      if (
        updatedRegs.some((r) => r.teamId === team._id) ||
        results.some(
          (r) =>
            r.teamId === team._id ||
            r.studentId === team.code ||
            r.studentId === teamLabel(team),
        )
      )
        throw new Error(
          `Team "${team.code}" is in use. Reassign its registrations and results before removing it.`,
        );
      await ctx.db.delete(team._id);
    }
  for (const event of before.events)
    if (!savedEventIds.has(event._id)) {
      if (
        updatedRegs.some((r) => r.meetEventIds?.includes(event._id)) ||
        results.some(
          (r) =>
            r.meetEventId === event._id ||
            findEvent(before.events, r.event)?._id === event._id,
        ) ||
        heats.some(
          (h) =>
            h.meetEventId === event._id ||
            findEvent(before.events, h.event)?._id === event._id,
        )
      )
        throw new Error(
          `Event "${eventLabel(event)}" is in use. Remove its entries before removing the event.`,
        );
      await ctx.db.delete(event._id);
    }
  await ctx.db.patch(meetId, {
    events: events.map(eventLabel),
    eventPointSystems: savedPoints,
    configurationVersion: 1,
  });
}
