import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getMeets = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("meets").collect();
  },
});

export const createMeet = mutation({
  args: {
    name: v.string(),
    date: v.string(),
    events: v.array(v.string()),
    pointSystem: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("meets", {
      name: args.name,
      date: args.date,
      events: args.events,
      status: "active",
      pointSystem: args.pointSystem,
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
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      name: args.name,
      date: args.date,
      events: args.events,
      pointSystem: args.pointSystem,
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
