import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  meets: defineTable({
    name: v.string(),
    date: v.string(),
    events: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("archived")),
    pointSystem: v.optional(v.array(v.number())),
    eventPointSystems: v.optional(v.record(v.string(), v.array(v.number()))),
    publicToken: v.optional(v.string()),
  }),

  students: defineTable({
    externalId: v.string(), // The UI's unique ID for the student
    name: v.string(),
    registrationNumber: v.string(),
    nameInUse: v.string(),
    gender: v.optional(v.union(v.literal("Male"), v.literal("Female"))),
    faculty: v.optional(v.string()),
    seed: v.optional(v.number()),
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

  users: defineTable({
    username: v.string(),
    password: v.string(), // Hashed
    role: v.union(v.literal("super_admin"), v.literal("admin"), v.literal("user")),
    name: v.string(),
  }).index("by_username", ["username"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  heatAssignments: defineTable({
    meetId: v.id("meets"),
    event: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female")),
    heat: v.number(),
    lane: v.number(),
    studentId: v.id("students"),
  }).index("by_meet_event_gender_heat", ["meetId", "event", "gender", "heat"]),
});
