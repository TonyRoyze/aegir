import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const LANES_PER_HEAT = 6;
const DEFAULT_LANE_ORDER = [3, 4, 2, 5, 1, 6];

export const getMeets = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("meets").collect();
  },
});

export const getHeatAssignments = query({
  args: {
    meetId: v.id("meets"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("heatAssignments")
      .withIndex("by_meet_event_gender_heat", (q) => q.eq("meetId", args.meetId))
      .collect();
  },
});

export const createMeet = mutation({
  args: {
    name: v.string(),
    date: v.string(),
    events: v.array(v.string()),
    pointSystem: v.optional(v.array(v.number())),
    eventPointSystems: v.optional(v.record(v.string(), v.array(v.number()))),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("meets", {
      name: args.name,
      date: args.date,
      events: args.events,
      status: "active",
      pointSystem: args.pointSystem,
      eventPointSystems: args.eventPointSystems,
    });
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
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { events: args.events });
  },
});

export const updateMeet = mutation({
  args: {
    id: v.id("meets"),
    name: v.string(),
    date: v.string(),
    events: v.array(v.string()),
    pointSystem: v.optional(v.array(v.number())),
    eventPointSystems: v.optional(v.record(v.string(), v.array(v.number()))),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      name: args.name,
      date: args.date,
      events: args.events,
      pointSystem: args.pointSystem,
      eventPointSystems: args.eventPointSystems,
    });
  },
});

export const deleteMeet = mutation({
  args: {
    id: v.id("meets"),
  },
  handler: async (ctx, args) => {
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
      .withIndex("by_meet_event_gender_heat", (q) => q.eq("meetId", args.meetId))
      .collect();
    for (const assignment of existingAssignments) {
      await ctx.db.delete(assignment._id);
    }

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_meetId", (q) => q.eq("meetId", args.meetId))
      .collect();

    const eventGenders: Record<string, "Male" | "Female"> = {};
    for (const event of meet.events) {
      if (event.startsWith("M:")) eventGenders[event] = "Male";
      else if (event.startsWith("W:")) eventGenders[event] = "Female";
    }

    for (const [event, gender] of Object.entries(eventGenders)) {
      const eventRegs = registrations.filter((r) =>
        r.events.includes(event)
      );

      const studentsWithSeeds = await Promise.all(
        eventRegs.map(async (reg) => {
          const student = await ctx.db.get(reg.studentId);
          return { studentId: reg.studentId, seed: student?.seed ?? 0 };
        })
      );

      studentsWithSeeds.sort((a, b) => b.seed - a.seed);

      const numHeats = Math.ceil(studentsWithSeeds.length / LANES_PER_HEAT);

      for (let heat = 0; heat < numHeats; heat++) {
        const heatStudents = studentsWithSeeds.slice(
          heat * LANES_PER_HEAT,
          (heat + 1) * LANES_PER_HEAT
        );

        heatStudents.forEach((s, i) => {
          const lane = DEFAULT_LANE_ORDER[i];
          if (lane) {
            ctx.db.insert("heatAssignments", {
              meetId: args.meetId,
              event,
              gender,
              heat: heat + 1,
              lane,
              studentId: s.studentId,
            });
          }
        });
      }
    }
  },
});
