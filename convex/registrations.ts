import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {
    meetId: v.optional(v.id("meets")),
  },
  handler: async (ctx, args) => {
    let registrations;
    if (args.meetId) {
      registrations = await ctx.db
        .query("registrations")
        .withIndex("by_meetId", (q) => q.eq("meetId", args.meetId))
        .collect();
    } else {
      registrations = await ctx.db.query("registrations").collect();
    }

    // Fetch all students related to these registrations
    // Optimization: We could fetch all students in one go if list is small, 
    // or fetch individually. Since this is likely a small meet (<1000), fetching all students is fine.
    // Or simpler: iterate and get.

    const results = [];
    for (const reg of registrations) {
      const student = await ctx.db.get(reg.studentId);
      if (student) {
        results.push({
          id: reg.externalId,
          student: {
            id: student.externalId,
            name: student.name,
            registrationNumber: student.registrationNumber,
            nameInUse: student.nameInUse,
            gender: student.gender,
            faculty: student.faculty,
          },
          events: reg.events,
          registeredAt: reg.registeredAt
        });
      }
    }
    return results;
  },
});

export const sync = mutation({
  args: {
    meetId: v.optional(v.id("meets")),
    registrations: v.array(
      v.object({
        id: v.string(), // This is the externalId for registration
        student: v.object({
          id: v.string(), // This is the externalId for student
          name: v.string(),
          registrationNumber: v.string(),
          nameInUse: v.string(),
          gender: v.optional(v.union(v.literal("Male"), v.literal("Female"))),
          faculty: v.optional(v.string()),
        }),
        events: v.array(v.string()),
        registeredAt: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 1. Get all current registrations for this meet (or all if no meet specified) to map externalId -> _id
    let currentRegs;
    if (args.meetId) {
      currentRegs = await ctx.db
        .query("registrations")
        .withIndex("by_meetId", (q) => q.eq("meetId", args.meetId))
        .collect();
    } else {
      currentRegs = await ctx.db.query("registrations").collect();
    }

    const currentRegsMap = new Map(currentRegs.map((r) => [r.externalId, r._id]));

    // We also need to manage students. 
    // Strategy: Upsert student first, then upsert registration.

    const incomingRegIds = new Set<string>();

    for (const reg of args.registrations) {
      incomingRegIds.add(reg.id);

      // A. Upsert Student
      // Check if student exists by externalId
      const existingStudent = await ctx.db
        .query("students")
        .withIndex("by_externalId", (q) => q.eq("externalId", reg.student.id))
        .unique();

      let studentId;
      const studentDoc = {
        externalId: reg.student.id,
        name: reg.student.name,
        registrationNumber: reg.student.registrationNumber,
        nameInUse: reg.student.nameInUse,
        gender: reg.student.gender,
        faculty: reg.student.faculty,
      };

      if (existingStudent) {
        studentId = existingStudent._id;
        await ctx.db.patch(studentId, studentDoc);
      } else {
        studentId = await ctx.db.insert("students", studentDoc);
      }

      // B. Upsert Registration
      const existingRegId = currentRegsMap.get(reg.id);
      const regDoc = {
        externalId: reg.id,
        studentId: studentId,
        meetId: args.meetId,
        events: reg.events,
        registeredAt: reg.registeredAt,
      };

      if (existingRegId) {
        await ctx.db.patch(existingRegId, regDoc);
      } else {
        await ctx.db.insert("registrations", regDoc);
      }
    }

    // 2. Delete stale registrations from this meet
    for (const [externalId, internalId] of currentRegsMap) {
      if (!incomingRegIds.has(externalId)) {
        await ctx.db.delete(internalId);
      }
    }

    // Optional: Delete orphan students? 
    // If a student has no registrations, should they remain?
    // For "sync" behavior where we just want to save the form state, maintaining just the active ones implies 
    // we might want to cleanup. Use a separate cron or just leave them for now to avoid complexity/accidental data loss.
  },
});
