import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Default point system if none provided (standard swimming dual/tri meet often varies, but this is a generic top 8)
const DEFAULT_POINTS = [9, 7, 6, 5, 4, 3, 2, 1];

export const getResults = query({
  args: {
    meetId: v.id("meets"),
    event: v.string(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("results")
      .withIndex("by_meet_event", (q) =>
        q.eq("meetId", args.meetId).eq("event", args.event)
      )
      .collect();

    // Enrich with student details using externalId
    const students = await Promise.all(
      results.map(r =>
        ctx.db
          .query("students")
          .withIndex("by_externalId", (q) => q.eq("externalId", r.studentId))
          .unique()
      )
    );

    return results.map((r, i) => ({
      ...r,
      student: students[i]
    })).sort((a, b) => (a.rank || 999) - (b.rank || 999));
  },
});

export const getMeetResults = query({
  args: {
    meetId: v.id("meets"),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("results")
      .withIndex("by_meet_event", (q) => q.eq("meetId", args.meetId))
      .collect();

    // Enrich with student details using externalId
    const studentIds = Array.from(new Set(results.map(r => r.studentId)));
    const studentsData = await Promise.all(
      studentIds.map(async (id) =>
        ctx.db
          .query("students")
          .withIndex("by_externalId", (q) => q.eq("externalId", id))
          .unique()
      )
    );

    const studentMap = new Map();
    studentIds.forEach((id, i) => studentMap.set(id, studentsData[i]));

    return results.map(r => ({
      ...r,
      student: studentMap.get(r.studentId)
    }));
  },
});

export const saveResult = mutation({
  args: {
    meetId: v.id("meets"),
    studentId: v.string(),
    event: v.string(),
    timing: v.number(), // in milliseconds
  },
  handler: async (ctx, args) => {
    // 1. Check if result exists
    const existing = await ctx.db
      .query("results")
      .withIndex("by_meet_event", (q) =>
        q.eq("meetId", args.meetId).eq("event", args.event)
      )
      .filter(q => q.eq(q.field("studentId"), args.studentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { timing: args.timing });
    } else {
      await ctx.db.insert("results", {
        meetId: args.meetId,
        studentId: args.studentId,
        event: args.event,
        timing: args.timing,
      });
    }

    // 2. Recalculate Ranks and Points for the event
    // Fetch all results for this event
    const allResults = await ctx.db
      .query("results")
      .withIndex("by_meet_event", (q) =>
        q.eq("meetId", args.meetId).eq("event", args.event)
      )
      .collect();

    // Sort by timing ASC
    allResults.sort((a, b) => a.timing - b.timing);

    // Get Meet Point System
    const meet = await ctx.db.get(args.meetId);
    const eventOverride = meet?.eventPointSystems?.[args.event];
    const pointsConfig = eventOverride || meet?.pointSystem || DEFAULT_POINTS;

    // Update ranks and points
    // Logic: Same time = same rank. Skip ranks after ties? (e.g. 1, 1, 3).
    // Let's implement standard competition ranking (1224)
    let currentRank = 1;
    for (let i = 0; i < allResults.length; i++) {
      const result = allResults[i];

      // If not first, check if tie with previous
      if (i > 0 && result.timing === allResults[i - 1].timing) {
        // It's a tie, keep same rank as previous
        // currentRank doesn't change for this swimmer, but 'i' increments
      } else {
        // distinct time, rank is i + 1
        currentRank = i + 1;
      }

      const points = pointsConfig[currentRank - 1] || 0;

      await ctx.db.patch(result._id, {
        rank: currentRank,
        points: points
      });
    }
  },
});
