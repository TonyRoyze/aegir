import assert from "node:assert/strict";
import { test } from "node:test";
import { assignToHeats } from "../lib/swimming-utils";
import { buildMeetProgramEvents } from "../lib/meet-program-pdf";
import { relayTeams } from "../lib/meet-participants";
import {
  eventCapacity,
  isRegistrationLimitExceeded,
} from "../lib/registration-rules";
import { formatTime } from "../lib/time";
import { preferredMeetId } from "../lib/meet-selection";
import { registrationSnapshot } from "../lib/registration-snapshot";

test("balanced heats preserve every participant, seed order, six slots and center lanes", () => {
  const participants = Array.from({ length: 7 }, (_, i) => ({
    name: `Swimmer ${i}`,
    seed: i,
    identity: i,
  }));
  const heats = assignToHeats(participants);
  assert.deepEqual(
    heats.map((heat) => heat.filter(Boolean).length),
    [4, 3],
  );
  assert.equal(heats[0][2]?.identity, 6);
  assert.equal(heats[0][3]?.identity, 5);
  assert.equal(new Set(heats.flat().filter(Boolean)).size, 7);
  assert.deepEqual(assignToHeats([]), [Array(6).fill(null)]);
});
test("program grouping renders one blank heat and separates prefixed genders", () => {
  const regs = [
    { student: { name: "Man", gender: "Male" }, events: ["M: 100m Freestyle"] },
    {
      student: { name: "Woman", gender: "Female" },
      events: ["M: 100m Freestyle"],
    },
  ];
  const events = buildMeetProgramEvents(regs, [
    "M: 100m Freestyle",
    "50m Freestyle",
  ]);
  assert.deepEqual(
    events[0].groups.map((group) => group.label),
    ["Women", "Men"],
  );
  assert.equal(events[1].groups.length, 1);
  assert.deepEqual(events[1].groups[0].heats, [Array(6).fill(null)]);
  assert.deepEqual(
    buildMeetProgramEvents(
      regs.map((reg) => ({ ...reg, events: ["100m Freestyle"] })),
      ["100m Freestyle"],
    )[0].groups.map((group) => group.label),
    ["Mixed"],
  );
});
test("relay identity uses stable team IDs, preserves Unknown fallback and public seed policy", () => {
  const members = [
    { name: "A", teamId: "team-1", faculty: "Same", seed: 9 },
    { name: "B", teamId: "team-1", faculty: "Same", seed: 2 },
    { name: "C", teamId: "team-2", faculty: "Same", seed: 3 },
    { name: "D" },
  ];
  const program = relayTeams(members);
  assert.deepEqual(
    program.map((team) => team.id),
    ["team-1", "team-2", "Unknown"],
  );
  assert.equal(program[0].seed, undefined);
  assert.equal(relayTeams(members, true)[0].seed, 9);
});
test("registration policy exempts relay and IM by name rather than event position", () => {
  assert.equal(
    isRegistrationLimitExceeded([
      "M: 50m Free",
      "M: 100m Free",
      "M: 50m Back",
      "M: 200m Individual Medley",
      "W: 4x50m Relay",
    ]),
    false,
  );
  assert.equal(isRegistrationLimitExceeded(["A", "B", "C", "D"]), true);
  assert.equal(eventCapacity("M: 4x50m relay"), 4);
  assert.equal(eventCapacity("M: 200m Individual Medley"), 2);
});
test("time strings preserve dashboard and compact public formats", () => {
  assert.equal(formatTime(12345), "0:12.34");
  assert.equal(formatTime(12345, true), "12.34");
  assert.equal(formatTime(72345, true), "1:12.34");
  assert.equal(formatTime(0), "-");
  assert.equal(formatTime(0, true), "0.00");
});
test("meet selection respects selection and recovers deleted selections", () => {
  const meets = [
    { _id: "a", status: "archived" },
    { _id: "b", status: "active" },
  ];
  assert.equal(preferredMeetId(meets, "a"), "a");
  assert.equal(preferredMeetId(meets, "deleted"), "b");
  assert.equal(preferredMeetId([]), null);
});
test("snapshot ignores projected metadata and order while detecting seed and team edits", () => {
  const row = {
    id: "a",
    student: {
      id: "s",
      name: "Alex",
      nameInUse: "Al",
      registrationNumber: "1",
      seed: 2,
    },
    events: ["B", "A"],
    registeredAt: "2026-10-02",
  };
  assert.equal(
    registrationSnapshot([row]),
    registrationSnapshot([
      { ...row, events: ["A", "B"], teamName: "ignored" } as typeof row,
    ]),
  );
  assert.notEqual(
    registrationSnapshot([row]),
    registrationSnapshot([{ ...row, teamId: "team" }]),
  );
  assert.notEqual(
    registrationSnapshot([row]),
    registrationSnapshot([{ ...row, student: { ...row.student, seed: 3 } }]),
  );
});

test("legacy team responses normalize into code-only configuration without losing registration identity", async () => {
  const { teamLabel, normalizeTeam, validateConfiguration } =
    await import("../lib/meet-configuration");
  const legacy = { id: "team-a", name: " FOS ", shortName: "Science" };
  const normalized = normalizeTeam(legacy);
  assert.equal(teamLabel(legacy), "FOS");
  assert.deepEqual(normalized, {
    id: "team-a",
    code: "FOS",
    legacyCode: " FOS ",
  });
  assert.equal("name" in normalized, false);
  assert.equal("shortName" in normalized, false);
  assert.equal(teamLabel({ name: "Old name", code: " NEW " }), "NEW");
  assert.equal(teamLabel({}), "");
  assert.equal(teamLabel(undefined), "");
  assert.equal(teamLabel({ code: 42 }), "");
  assert.throws(
    () => validateConfiguration([{ id: "bad" } as never], []),
    /team code is required/,
  );
  validateConfiguration([normalized], []);
});
