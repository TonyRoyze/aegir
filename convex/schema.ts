import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  meets: defineTable({
    name: v.string(),
    date: v.string(),
    events: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("archived")),
    pointSystem: v.optional(v.array(v.number())), // e.g. [10, 8, 6, 5, 4, 3, 2, 1]
    eventPointSystems: v.optional(v.record(v.string(), v.array(v.number()))), // Event name -> Point list override
  }),

  students: defineTable({
    externalId: v.string(), // The UI's unique ID for the student
    name: v.string(),
    registrationNumber: v.string(),
    nameInUse: v.string(),
    gender: v.optional(v.union(v.literal("Male"), v.literal("Female"))),
    faculty: v.optional(v.string()),
  }).index("by_externalId", ["externalId"]),

  registrations: defineTable({
    externalId: v.string(), // The UI's unique ID for the registration row
    studentId: v.id("students"),
    meetId: v.optional(v.id("meets")), // Optional for backward compatibility during dev
    events: v.array(v.string()),
    registeredAt: v.string(),
  }).index("by_externalId", ["externalId"])
    .index("by_studentId", ["studentId"])
    .index("by_meetId", ["meetId"]),

  results: defineTable({
    meetId: v.id("meets"),
    studentId: v.string(), // External ID of the student
    event: v.string(),
    timing: v.number(), // in milliseconds
    rank: v.optional(v.number()),
    points: v.optional(v.number()),
  }).index("by_meet_event", ["meetId", "event"])
    .index("by_meet_student", ["meetId", "studentId"]),

  albums: defineTable({
    title: v.string(),
    date: v.string(),
    description: v.string(),
    link: v.string(),
    coverImage: v.optional(v.string()),
  }),
});
