import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  configuration,
  ensureConfiguration,
  projectMeet,
  saveConfiguration,
  teamValidator,
  eventValidator,
  registrationEvents,
  registrationTeam,
  meetRegistrations,
} from "./meetConfiguration";
import {
  eventLabel,
  parseLegacyEvent,
  teamLabel,
} from "../lib/meet-configuration";

const LANES_PER_HEAT = 6;
const DEFAULT_LANE_ORDER = [3, 4, 2, 5, 1, 6];

function makeToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export const getMeets = query({
  args: {},
  handler: async (ctx) => {
    const meets = await ctx.db.query("meets").take(201);
    if (meets.length > 200)
      throw new Error("Use a paginated meet listing for more than 200 meets.");
    return await Promise.all(meets.map((meet) => projectMeet(ctx, meet)));
  },
});

export const getHeatAssignments = query({
  args: {
    meetId: v.id("meets"),
  },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("heatAssignments")
      .withIndex("by_meet_event_gender_heat", (q) =>
        q.eq("meetId", args.meetId),
      )
      .take(5000);

    const config = await configuration(ctx, args.meetId);
    const regs = await meetRegistrations(ctx, args.meetId);
    // Fetch student details for each assignment
    const studentIds = [...new Set(assignments.map((a) => a.studentId))];
    const students = new Map();
    for (const id of studentIds) {
      const student = await ctx.db.get(id);
      if (student) {
        const reg = regs.find((r) => r.studentId === id);
        const team = reg && registrationTeam(reg, student, config.teams);
        students.set(id, {
          ...student,
          teamId: team?._id,
          faculty: team ? teamLabel(team) : student.faculty,
        });
      }
    }

    // Map student data to each assignment
    return assignments.map((a) => ({
      ...a,
      event: config.events.find((e) => e._id === a.meetEventId)
        ? eventLabel(config.events.find((e) => e._id === a.meetEventId)!)
        : a.event,
      student: students.get(a.studentId),
    }));
  },
});

export const createMeet = mutation({
  args: {
    name: v.string(),
    date: v.string(),
    events: v.array(v.string()),
    teams: v.optional(v.array(teamValidator)),
    configuredEvents: v.optional(v.array(eventValidator)),
    pointSystem: v.optional(v.array(v.number())),
    eventPointSystems: v.optional(v.record(v.string(), v.array(v.number()))),
  },
  handler: async (ctx, args) => {
    const meetId = await ctx.db.insert("meets", {
      name: args.name,
      date: args.date,
      events: [],
      configurationVersion: 1,
      status: "active",
      pointSystem: args.pointSystem,
      eventPointSystems: args.eventPointSystems,
    });
    await saveConfiguration(
      ctx,
      meetId,
      args.teams ?? [],
      args.configuredEvents ?? args.events.map(parseLegacyEvent),
    );
    return meetId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("meets"),
    status: v.union(v.literal("active"), v.literal("archived")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const updateEvents = mutation({
  args: {
    id: v.id("meets"),
    events: v.array(v.string()),
    teams: v.optional(v.array(teamValidator)),
    configuredEvents: v.optional(v.array(eventValidator)),
  },
  handler: async (ctx, args) => {
    const meet = await projectMeet(ctx, (await ctx.db.get(args.id))!);
    await saveConfiguration(
      ctx,
      args.id,
      args.teams ?? meet.teams,
      args.configuredEvents ?? args.events.map(parseLegacyEvent),
    );
  },
});

export const updateMeet = mutation({
  args: {
    id: v.id("meets"),
    name: v.string(),
    date: v.string(),
    events: v.array(v.string()),
    teams: v.optional(v.array(teamValidator)),
    configuredEvents: v.optional(v.array(eventValidator)),
    pointSystem: v.optional(v.array(v.number())),
    eventPointSystems: v.optional(v.record(v.string(), v.array(v.number()))),
  },
  handler: async (ctx, args) => {
    const previous = await ctx.db.get(args.id);
    if (!previous) throw new Error("Meet not found.");
    const projected = await projectMeet(ctx, previous);
    await saveConfiguration(
      ctx,
      args.id,
      args.teams ?? projected.teams,
      args.configuredEvents ?? args.events.map(parseLegacyEvent),
      args.eventPointSystems,
    );
    await ctx.db.patch(args.id, {
      name: args.name,
      date: args.date,
      pointSystem: args.pointSystem,
    });
  },
});

export const deleteMeet = mutation({
  args: {
    id: v.id("meets"),
  },
  handler: async (ctx, args) => {
    const regs = await meetRegistrations(ctx, args.id);
    const results = await ctx.db
      .query("results")
      .withIndex("by_meet_event", (q) => q.eq("meetId", args.id))
      .first();
    const heat = await ctx.db
      .query("heatAssignments")
      .withIndex("by_meet_event_gender_heat", (q) => q.eq("meetId", args.id))
      .first();
    if (regs.length || results || heat)
      throw new Error(
        "This meet has registrations, results or heats. Archive it instead.",
      );
    const config = await configuration(ctx, args.id);
    for (const row of [...config.teams, ...config.events])
      await ctx.db.delete(row._id);
    await ctx.db.delete(args.id);
  },
});

export const generateHeatAssignments = mutation({
  args: {
    meetId: v.id("meets"),
  },
  handler: async (ctx, args) => {
    const meet = await ctx.db.get(args.meetId);
    if (!meet) throw new Error("Meet not found");

    const existingAssignments = await ctx.db
      .query("heatAssignments")
      .withIndex("by_meet_event_gender_heat", (q) =>
        q.eq("meetId", args.meetId),
      )
      .take(5000);
    for (const assignment of existingAssignments) {
      await ctx.db.delete(assignment._id);
    }

    const config = await ensureConfiguration(ctx, args.meetId);
    const registrations = await meetRegistrations(ctx, args.meetId);

    for (const configuredEvent of config.events) {
      const event = eventLabel(configuredEvent);
      const gender = configuredEvent.gender ?? "Mixed";
      const eventRegs = registrations.filter((r) =>
        registrationEvents(r, config.events).includes(event),
      );

      const studentsWithSeeds = await Promise.all(
        eventRegs.map(async (reg) => {
          const student = await ctx.db.get(reg.studentId);
          return { studentId: reg.studentId, seed: student?.seed ?? 0 };
        }),
      );

      studentsWithSeeds.sort((a, b) => b.seed - a.seed);

      const numHeats = Math.ceil(studentsWithSeeds.length / LANES_PER_HEAT);

      for (let heat = 0; heat < numHeats; heat++) {
        const heatStudents = studentsWithSeeds.slice(
          heat * LANES_PER_HEAT,
          (heat + 1) * LANES_PER_HEAT,
        );

        for (const [i, s] of heatStudents.entries()) {
          const lane = DEFAULT_LANE_ORDER[i];
          if (lane) {
            await ctx.db.insert("heatAssignments", {
              meetId: args.meetId,
              event,
              meetEventId: configuredEvent._id,
              gender,
              heat: heat + 1,
              lane,
              studentId: s.studentId,
            });
          }
        }
      }
    }
  },
});

export const generatePublicToken = mutation({
  args: {
    meetId: v.id("meets"),
  },
  handler: async (ctx, args) => {
    const meet = await ctx.db.get(args.meetId);
    if (!meet) throw new Error("Meet not found");

    const token = makeToken();
    await ctx.db.patch(args.meetId, { publicToken: token });
    return token;
  },
});

export const getMeetByPublicToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const meets = await ctx.db.query("meets").take(5000);
    const meet = meets.find((m) => m.publicToken === args.token);
    if (!meet) return null;

    const projected = await projectMeet(ctx, meet);
    return {
      _id: meet._id,
      name: meet.name,
      date: meet.date,
      events: projected.events,
      teams: projected.teams,
      configuredEvents: projected.configuredEvents,
    };
  },
});
