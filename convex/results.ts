import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  ensureConfiguration,
  findEvent,
  meetRegistrations,
  registrationTeam,
  MAX_RESULTS,
} from "./meetConfiguration";
import { projectResults } from "./resultHelpers";
import { eventLabel, teamLabel } from "../lib/meet-configuration";
const DEFAULT_POINTS = [9, 7, 6, 5, 4, 3, 2, 1];
export const getResults = query({
  args: { meetId: v.id("meets"), event: v.string() },
  handler: async (ctx, args) =>
    (await projectResults(ctx, args.meetId, undefined, args.event)).sort(
      (a, b) => (a.rank ?? 999) - (b.rank ?? 999),
    ),
});
export const getMeetResults = query({
  args: { meetId: v.id("meets") },
  handler: (ctx, args) => projectResults(ctx, args.meetId),
});
export const saveResult = mutation({
  args: {
    meetId: v.id("meets"),
    studentId: v.string(),
    event: v.string(),
    meetEventId: v.optional(v.id("meetEvents")),
    timing: v.number(),
  },
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.timing) || args.timing <= 0)
      throw new Error("Timing must be a positive number.");
    const config = await ensureConfiguration(ctx, args.meetId);
    const event = args.meetEventId
      ? config.events.find((e) => e._id === args.meetEventId)
      : findEvent(config.events, args.event);
    if (!event) throw new Error("The event does not belong to this meet.");
    const relay = event.stroke.toLowerCase().includes("relay");
    const regs = await meetRegistrations(ctx, args.meetId);
    let team;
    let participantId = args.studentId;
    if (relay) {
      team = config.teams.find(
        (t) =>
          t._id === args.studentId ||
          teamLabel(t) === args.studentId ||
          t.code === args.studentId,
      );
      if (!team) throw new Error("Choose a team from this meet.");
      const teamEntered = await Promise.all(
        regs.map(async (r) => {
          const s = await ctx.db.get(r.studentId);
          return (
            s &&
            registrationTeam(r, s, config.teams)?._id === team!._id &&
            (r.meetEventIds?.includes(event._id) ||
              (!r.meetEventIds &&
                r.events.some(
                  (label) => findEvent(config.events, label)?._id === event._id,
                )))
          );
        }),
      );
      if (!teamEntered.some(Boolean))
        throw new Error("This team is not entered in the relay.");
      participantId = team._id;
    } else {
      const student = await ctx.db
        .query("students")
        .withIndex("by_externalId", (q) => q.eq("externalId", args.studentId))
        .unique();
      const reg = student && regs.find((r) => r.studentId === student._id);
      if (
        !student ||
        !reg ||
        !(
          reg.meetEventIds?.includes(event._id) ||
          (!reg.meetEventIds &&
            reg.events.some(
              (label) => findEvent(config.events, label)?._id === event._id,
            ))
        )
      )
        throw new Error("The swimmer is not entered in this meet event.");
      team = registrationTeam(reg, student, config.teams);
    }
    const all = await ctx.db
      .query("results")
      .withIndex("by_meet_event", (q) => q.eq("meetId", args.meetId))
      .take(MAX_RESULTS + 1);
    if (all.length > MAX_RESULTS)
      throw new Error("Meet results exceed the supported size.");
    const eventResults = all.filter(
      (r) =>
        r.meetEventId === event._id ||
        (!r.meetEventId &&
          findEvent(config.events, r.event)?._id === event._id),
    );
    const existing = eventResults.find(
      (r) =>
        r.studentId === participantId ||
        (relay &&
          (r.teamId === team?._id ||
            r.studentId === team?.code ||
            r.studentId === teamLabel(team!))),
    );
    const fields = {
      meetId: args.meetId,
      studentId: participantId,
      teamId: team?._id,
      meetEventId: event._id,
      event: eventLabel(event),
      timing: args.timing,
    };
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("results", fields);
    const ranked = await projectResults(ctx, args.meetId, event._id);
    ranked.sort((a, b) => a.timing - b.timing);
    const meet = await ctx.db.get(args.meetId);
    const points =
      meet?.eventPointSystems?.[event._id] ??
      meet?.eventPointSystems?.[eventLabel(event)] ??
      meet?.eventPointSystems?.[event.legacyLabel ?? ""] ??
      meet?.eventPointSystems?.[
        `${event.legs && event.legs > 1 ? `${event.legs}x` : ""}${event.distance}m ${event.stroke}`
      ] ??
      meet?.pointSystem ??
      DEFAULT_POINTS;
    for (let i = 0; i < ranked.length; ) {
      let end = i;
      while (
        end + 1 < ranked.length &&
        ranked[end + 1].timing === ranked[i].timing
      )
        end++;
      let total = 0;
      for (let p = i; p <= end; p++) total += points[p] ?? 0;
      for (let p = i; p <= end; p++)
        await ctx.db.patch(ranked[p]._id, {
          rank: i + 1,
          points: total / (end - i + 1),
        });
      i = end + 1;
    }
  },
});

export const clearResult = mutation({
  args: {
    meetId: v.id("meets"),
    studentId: v.string(),
    event: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ensureConfiguration(ctx, args.meetId);
    const event = findEvent(config.events, args.event);
    if (!event) throw new Error("The event does not belong to this meet.");
    const all = await ctx.db
      .query("results")
      .withIndex("by_meet_event", (q) => q.eq("meetId", args.meetId))
      .take(MAX_RESULTS + 1);
    if (all.length > MAX_RESULTS)
      throw new Error("Meet results exceed the supported size.");
    const existing = all.find(
      (r) =>
        (r.meetEventId === event._id ||
          (!r.meetEventId && findEvent(config.events, r.event)?._id === event._id)) &&
        r.studentId === args.studentId,
    );
    if (!existing) return;
    await ctx.db.delete(existing._id);

    const ranked = await projectResults(ctx, args.meetId, event._id);
    ranked.sort((a, b) => a.timing - b.timing);
    const meet = await ctx.db.get(args.meetId);
    const points =
      meet?.eventPointSystems?.[event._id] ??
      meet?.eventPointSystems?.[eventLabel(event)] ??
      meet?.eventPointSystems?.[event.legacyLabel ?? ""] ??
      meet?.eventPointSystems?.[
        `${event.legs && event.legs > 1 ? `${event.legs}x` : ""}${event.distance}m ${event.stroke}`
      ] ??
      meet?.pointSystem ??
      DEFAULT_POINTS;
    for (let i = 0; i < ranked.length; ) {
      let end = i;
      while (end + 1 < ranked.length && ranked[end + 1].timing === ranked[i].timing)
        end++;
      let total = 0;
      for (let p = i; p <= end; p++) total += points[p] ?? 0;
      for (let p = i; p <= end; p++)
        await ctx.db.patch(ranked[p]._id, {
          rank: i + 1,
          points: total / (end - i + 1),
        });
      i = end + 1;
    }
  },
});
