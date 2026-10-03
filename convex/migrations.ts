import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import {
  ensureConfiguration,
  migrateRegistration,
  findEvent,
} from "./meetConfiguration";
import { teamLabel } from "../lib/meet-configuration";

const migrations = new Migrations<DataModel>(components.migrations);
export const configureMeets = migrations.define({
  table: "meets",
  batchSize: 1,
  migrateOne: async (ctx, meet) => {
    await ensureConfiguration(ctx, meet._id);
  },
});
export const registrationReferences = migrations.define({
  table: "registrations",
  batchSize: 20,
  migrateOne: (ctx, reg) => migrateRegistration(ctx, reg),
});
export const resultReferences = migrations.define({
  table: "results",
  batchSize: 20,
  migrateOne: async (ctx, result) => {
    const config = await ensureConfiguration(ctx, result.meetId);
    const event = findEvent(config.events, result.event);
    if (!event && !result.meetEventId)
      throw new Error(`Unknown event in result ${result._id}: ${result.event}`);
    const team = config.teams.find(
      (t) => t.code === result.studentId || teamLabel(t) === result.studentId,
    );
    return {
      meetEventId: result.meetEventId ?? event?._id,
      ...(event?.stroke.toLowerCase().includes("relay") && team
        ? { teamId: team._id }
        : {}),
    };
  },
});
export const heatReferences = migrations.define({
  table: "heatAssignments",
  batchSize: 20,
  migrateOne: async (ctx, heat) => {
    if (heat.meetEventId) return;
    const config = await ensureConfiguration(ctx, heat.meetId);
    const event = findEvent(config.events, heat.event);
    if (!event)
      throw new Error(`Unknown event in heat ${heat._id}: ${heat.event}`);
    return { meetEventId: event._id };
  },
});
export const runAll = migrations.runner([
  internal.migrations.configureMeets,
  internal.migrations.registrationReferences,
  internal.migrations.resultReferences,
  internal.migrations.heatReferences,
]);
