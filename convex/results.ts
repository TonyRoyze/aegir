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

    // Enrich with student details
    const studentIds = results.map(r => r.studentId);
    const students = await Promise.all(studentIds.map(id => ctx.db.get(id)));

    return results.map((r, i) => ({
      ...r,
      student: students[i]
    })).sort((a, b) => (a.rank || 999) - (b.rank || 999));
  },
});

export const saveResult = mutation({
  args: {
    meetId: v.id("meets"),
    studentId: v.id("students"),
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
    const pointsConfig = meet?.pointSystem || DEFAULT_POINTS;

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
