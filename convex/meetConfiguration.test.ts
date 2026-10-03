/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { ensureConfiguration, migrateRegistration } from "./meetConfiguration";
const modules = import.meta.glob("./**/*.ts");
const event = { distance: 100, stroke: "Freestyle", gender: "Male" as const };
const meetArgs = (name: string) => ({
  name,
  date: "2026-10-02",
  events: [],
  teams: [{ code: "SCI" }],
  configuredEvents: [
    event,
    { ...event, gender: "Mixed" as const, distance: 50 },
  ],
});
async function setup() {
  const t = convexTest(schema, modules);
  const meetId = await t.mutation(api.meets.createMeet, meetArgs("Meet A"));
  const otherId = await t.mutation(api.meets.createMeet, meetArgs("Meet B"));
  const meets = await t.query(api.meets.getMeets, {});
  const meet = meets.find((m) => m._id === meetId)!;
  const reg = {
    id: "registration-a",
    teamId: meet.teams[0].id as Id<"meetTeams">,
    student: {
      id: "student-a",
      name: "Alex",
      nameInUse: "Alex",
      registrationNumber: "123",
      gender: "Male" as const,
    },
    events: [meet.events[0], meet.events[1]],
    registeredAt: "2026-10-02",
  };
  await t.mutation(api.registrations.sync, { meetId, registrations: [reg] });
  return { t, meetId, otherId, meet, reg };
}
describe("meet configuration", () => {
  it("isolates team assignment per meet and keeps global faculty intact", async () => {
    const { t, meetId, otherId, meet, reg } = await setup();
    await t.run(async (ctx) => {
      const student = await ctx.db.query("students").first();
      await ctx.db.patch(student!._id, { faculty: "Original faculty" });
    });
    const other = (await t.query(api.meets.getMeets, {})).find(
      (m) => m._id === otherId,
    )!;
    await t.mutation(api.registrations.sync, {
      meetId: otherId,
      registrations: [
        {
          ...reg,
          id: "registration-b",
          teamId: other.teams[0].id as typeof reg.teamId,
        },
      ],
    });
    await t.mutation(api.meets.updateMeet, {
      ...meetArgs("Renamed"),
      id: meetId,
      teams: [{ ...meet.teams[0], code: "NEW" }] as never,
      configuredEvents: meet.configuredEvents as never,
    });
    expect(
      (await t.query(api.registrations.get, { meetId }))[0].student.faculty,
    ).toBe("NEW");
    expect(
      (await t.query(api.registrations.get, { meetId: otherId }))[0].student
        .faculty,
    ).toBe("SCI");
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query("students").first())?.faculty,
      ),
    ).toBe("Original faculty");
  });
  it("preserves result, entry and heat identity after renaming and reordering events", async () => {
    const { t, meetId, meet } = await setup();
    await t.mutation(api.results.saveResult, {
      meetId,
      event: meet.events[0],
      studentId: "student-a",
      timing: 12000,
    });
    await t.mutation(api.meets.generateHeatAssignments, { meetId });
    const changed = [
      meet.configuredEvents[1],
      { ...meet.configuredEvents[0], distance: 200 },
    ];
    await t.mutation(api.meets.updateMeet, {
      ...meetArgs("Meet A"),
      id: meetId,
      teams: meet.teams as never,
      configuredEvents: changed as never,
    });
    const results = await t.query(api.results.getResults, {
      meetId,
      event: "M:200m Freestyle",
    });
    expect(results).toHaveLength(1);
    expect(results[0].timing).toBe(12000);
    expect(
      (await t.query(api.registrations.get, { meetId }))[0].events,
    ).toContain("M:200m Freestyle");
    const heats = await t.query(api.meets.getHeatAssignments, { meetId });
    expect(heats.some((h) => h.event === "M:200m Freestyle")).toBe(true);
    expect(heats.some((h) => h.gender === "Mixed")).toBe(true);
  });
  it("rejects invalid and duplicate events atomically", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.meets.createMeet, {
        ...meetArgs("Bad"),
        configuredEvents: [{ ...event, distance: 0 }],
      }),
    ).rejects.toThrow("positive");
    await expect(
      t.mutation(api.meets.createMeet, {
        ...meetArgs("Bad"),
        configuredEvents: [event, event],
      }),
    ).rejects.toThrow("Duplicate");
    await expect(t.mutation(api.meets.createMeet, {...meetArgs("Bad teams"), teams:[{code:"SCI"},{code:" sci "}]})).rejects.toThrow("unique");
    expect(await t.query(api.meets.getMeets, {})).toHaveLength(0);
  });
  it("rejects foreign teams and removing events with entries", async () => {
    const { t, meetId, otherId, meet, reg } = await setup();
    const other = (await t.query(api.meets.getMeets, {})).find(
      (m) => m._id === otherId,
    )!;
    await expect(
      t.mutation(api.registrations.sync, {
        meetId,
        registrations: [
          { ...reg, teamId: other.teams[0].id as typeof reg.teamId },
        ],
      }),
    ).rejects.toThrow("Choose a team");
    await expect(
      t.mutation(api.meets.updateMeet, {
        ...meetArgs("Meet A"),
        id: meetId,
        teams: meet.teams as never,
        configuredEvents: [],
      }),
    ).rejects.toThrow("in use");
    expect(
      (await t.query(api.meets.getMeets, {})).find((m) => m._id === meetId)
        ?.events,
    ).toHaveLength(2);
  });
  it("converts legacy events and faculty assignments idempotently", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const meetId = await ctx.db.insert("meets", {
        name: "Legacy",
        date: "2026-10-02",
        status: "active",
        events: ["W:4x25m Freestyle Relay"],
      });
      const studentId = await ctx.db.insert("students", {
        externalId: "old",
        name: "Sam",
        nameInUse: "Sam",
        registrationNumber: "1",
        gender: "Female",
        faculty: "Arts",
      });
      const regId = await ctx.db.insert("registrations", {
        externalId: "old-reg",
        meetId,
        studentId,
        events: ["W:4x25m Freestyle Relay"],
        registeredAt: "2026-10-02",
      });
      await ensureConfiguration(ctx, meetId);
      await migrateRegistration(ctx, (await ctx.db.get(regId))!);
      await ensureConfiguration(ctx, meetId);
      return { meetId, regId };
    });
    const meet = (await t.query(api.meets.getMeets, {}))[0];
    expect(meet.teams).toHaveLength(1);
    expect(meet.configuredEvents[0].legs).toBe(4);
    const reg = await t.query(api.registrations.get, { meetId: ids.meetId });
    expect(reg[0].teamId).toBe(meet.teams[0].id);
    await t.mutation(api.results.saveResult, {
      meetId: ids.meetId,
      studentId: meet.teams[0].id!,
      event: meet.events[0],
      timing: 30000,
    });
    await t.mutation(api.meets.updateMeet, {
      id: ids.meetId,
      name: "Legacy",
      date: "2026-10-02",
      events: [],
      teams: [{ ...meet.teams[0], code: "HUM" }] as never,
      configuredEvents: meet.configuredEvents as never,
    });
    expect(
      (await t.query(api.results.getMeetResults, { meetId: ids.meetId }))[0]
        .teamName,
    ).toBe("HUM");
  });
  it("keeps event point overrides when event labels change", async () => {
    const { t, meetId, meet } = await setup();
    await t.mutation(api.meets.updateMeet, {
      ...meetArgs("Meet A"),
      id: meetId,
      teams: meet.teams as never,
      configuredEvents: meet.configuredEvents as never,
      eventPointSystems: { [meet.events[0]]: [20, 10] },
    });
    await t.mutation(api.meets.updateMeet, {
      ...meetArgs("Meet A"),
      id: meetId,
      teams: meet.teams as never,
      configuredEvents: [
        { ...meet.configuredEvents[0], distance: 200 },
        meet.configuredEvents[1],
      ] as never,
    });
    await t.mutation(api.results.saveResult, {
      meetId,
      event: "M:200m Freestyle",
      studentId: "student-a",
      timing: 12000,
    });
    expect(
      (
        await t.query(api.results.getResults, {
          meetId,
          event: "M:200m Freestyle",
        })
      )[0].points,
    ).toBe(20);
  });
  it("dry-runs and backfills legacy references without changing snapshots", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const meetId = await ctx.db.insert("meets", {
        name: "Legacy",
        date: "2026-10-02",
        status: "active",
        events: ["M:100m Freestyle"],
      });
      const studentId = await ctx.db.insert("students", {
        externalId: "legacy",
        name: "Sam",
        nameInUse: "Sam",
        registrationNumber: "1",
        gender: "Male",
        faculty: "Arts",
      });
      const regId = await ctx.db.insert("registrations", {
        externalId: "legacy-reg",
        meetId,
        studentId,
        events: ["M:100m Freestyle"],
        registeredAt: "2026-10-02",
      });
      const resultId = await ctx.db.insert("results", {
        meetId,
        studentId: "legacy",
        event: "M:100m Freestyle",
        timing: 10000,
      });
      const heatId = await ctx.db.insert("heatAssignments", {
        meetId,
        studentId,
        event: "M:100m Freestyle",
        gender: "Male",
        heat: 1,
        lane: 3,
      });
      return { meetId, regId, resultId, heatId };
    });
    await expect(
      t.mutation(internal.migrations.configureMeets, {
        dryRun: true,
        cursor: null,
      }),
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query("meetEvents").take(10)),
    ).toHaveLength(0);
    for (const migration of [
      internal.migrations.configureMeets,
      internal.migrations.registrationReferences,
      internal.migrations.resultReferences,
      internal.migrations.heatReferences,
    ]) {
      await t.mutation(migration, { dryRun: false, cursor: null });
      await t.mutation(migration, { dryRun: false, cursor: null });
    }
    await t.run(async (ctx) => {
      const reg = await ctx.db.get(ids.regId),
        result = await ctx.db.get(ids.resultId),
        heat = await ctx.db.get(ids.heatId);
      expect(reg?.teamId).toBeDefined();
      expect(reg?.meetEventIds?.[0]).toBe(result?.meetEventId);
      expect(heat?.meetEventId).toBe(result?.meetEventId);
      expect(result?.event).toBe("M:100m Freestyle");
      expect(await ctx.db.query("meetEvents").take(10)).toHaveLength(1);
    });
  });
});

describe("cleanup regressions", () => {
  it("rejects a stale full snapshot without deleting or replacing another editor's rows", async () => {
    const { t, meetId, reg } = await setup();
    const { registrationSnapshot } = await import("../lib/registration-snapshot");
    const original = await t.query(api.registrations.get, { meetId });
    const changed = { ...reg, student: { ...reg.student, name: "Remote editor" } };
    await t.mutation(api.registrations.sync, { meetId, registrations: [changed], expectedSnapshot: registrationSnapshot(original) });
    await expect(t.mutation(api.registrations.sync, { meetId, registrations: [], expectedSnapshot: registrationSnapshot(original) })).rejects.toThrow("Registrations changed");
    const current = await t.query(api.registrations.get, { meetId });
    expect(current).toHaveLength(1);
    expect(current[0].student.name).toBe("Remote editor");
    const saved = await t.mutation(api.registrations.sync, { meetId, registrations: [{...changed, student:{...changed.student, seed: 7}}], expectedSnapshot: registrationSnapshot(current) });
    expect(saved[0].student.seed).toBe(7);
  });
  it("missing meet stats return empty totals rather than exposing other meets", async () => {
    const { t, meetId } = await setup();
    await t.run(ctx => ctx.db.delete(meetId));
    const stats = await t.query(api.dashboard.getStats, {meetId});
    expect(stats.totalParticipants).toBe(0);
    expect(stats.totalEntries).toBe(0);
    expect(stats.facultyLeaderboard).toEqual([]);
    expect(stats.studentLeaderboard).toEqual([]);
  });
  it("reuses super-admin checks and redacts hashes from session and user-list responses", async () => {
    const t = convexTest(schema, modules);
    const { hashSync } = await import("bcryptjs");
    const password = "test-password";
    await t.run(async ctx => {
      await ctx.db.insert("users", {username:"root", name:"Root",role:"super_admin",password:hashSync(password,4)});
      await ctx.db.insert("users", {username:"admin", name:"Admin",role:"admin",password:hashSync(password,4)});
    });
    const login = await t.mutation(api.auth.login,{username:"root",password});
    expect(login.user).not.toHaveProperty("password");
    expect(await t.query(api.auth.me,{token:login.token})).not.toHaveProperty("password");
    const users = await t.query(api.auth.listUsers,{token:login.token});
    expect(users).toHaveLength(2);
    for (const user of users) expect(user).not.toHaveProperty("password");
    const admin = await t.mutation(api.auth.login,{username:"admin",password});
    await expect(t.query(api.auth.listUsers,{token:admin.token})).rejects.toThrow("Only super admins");
    await expect(t.mutation(api.auth.createUser,{adminToken:admin.token,userData:{username:"new",name:"New",role:"admin",password}})).rejects.toThrow("Only super admins");
    await t.run(async ctx => {
      const session = await ctx.db.query("sessions").withIndex("by_token",q=>q.eq("token",login.token)).unique();
      await ctx.db.patch(session!._id,{expiresAt:Date.now()-1});
    });
    expect(await t.query(api.auth.me,{token:login.token})).toBeNull();
    await expect(t.query(api.auth.listUsers,{token:login.token})).rejects.toThrow("Not authenticated");
    await t.mutation(api.auth.logout,{token:admin.token});
    expect(await t.query(api.auth.me,{token:admin.token})).toBeNull();
  });
});
