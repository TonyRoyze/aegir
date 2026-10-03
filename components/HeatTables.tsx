"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { displayFaculty, LANES_PER_HEAT } from "@/lib/swimming-utils";

import {
  buildMeetProgramEvents,
  type MeetProgramRegistration,
  type MeetProgramStudent,
} from "@/lib/meet-program-pdf";
import type { MeetResult } from "@/lib/result-types";

// --- Helpers ---

const getParts = (ms: number | undefined | null) => {
  if (ms === undefined || ms === null || ms === 0)
    return { m: "", s: "", h: "" };
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const hundredths = Math.floor((ms % 1000) / 10);
  return {
    m: minutes.toString(),
    s: seconds.toString().padStart(2, "0"),
    h: hundredths.toString().padStart(2, "0"),
  };
};

type ResultStudent = {
  externalId?: string;
  id?: string;
  _id?: string;
};

type ResultRow = {
  event: string;
  studentId: string;
};

const getResultStudentId = (student: ResultStudent | null | undefined) => {
  if (!student) return "";
  return student.externalId || student.id || student._id || "";
};

const getResultStudentIds = (student: ResultStudent | null | undefined) => {
  return [student?.externalId, student?.id, student?._id].filter(Boolean);
};

const findStudentResult = <T extends ResultRow>(
  allResults: T[],
  eventName: string,
  student: ResultStudent | null | undefined,
) => {
  const studentIds = getResultStudentIds(student);
  return allResults?.find(
    (r) => r.event === eventName && studentIds.includes(r.studentId),
  );
};

// --- Row Component ---

function StudentRow({
  student,
  eventName,
  isRelayEvent,
  allResults,
  onSave,
  onClear,
  savingId,
  laneIndex,
}: {
  student: MeetProgramStudent | null;
  eventName: string;
  isRelayEvent: boolean;
  allResults: MeetResult[];
  onSave: (studentId: string, ms: number) => Promise<void>;
  onClear: (studentId: string) => Promise<void>;
  savingId: string | null;
  laneIndex: number;
}) {
  const savedTiming = findStudentResult(allResults, eventName, student)?.timing;
  const identity = `${eventName}:${getResultStudentId(student)}`;
  const [draft, setDraft] = useState<{
    identity: string;
    baseTiming: number | undefined;
    parts: ReturnType<typeof getParts>;
  } | null>(null);
  const localInputs =
    draft?.identity === identity && draft.baseTiming === savedTiming
      ? draft.parts
      : getParts(savedTiming);

  const updateInput = (field: "m" | "s" | "h", val: string) => {
    if (val && !/^\d+$/.test(val)) return;
    if (field !== "m" && val.length > 2) return;
    setDraft({
      identity,
      baseTiming: savedTiming,
      parts: { ...localInputs, [field]: val },
    });
  };

  const handleBlur = async () => {
    if (!student) return;
    const studentId = getResultStudentId(student);
    const p = localInputs;
    const currentRes = findStudentResult(allResults, eventName, student);
    if (p.m === "" && p.s === "" && p.h === "") {
      if (currentRes) await onClear(studentId);
      return;
    }

    const ms =
      parseInt(p.m || "0") * 60000 +
      parseInt(p.s || "0") * 1000 +
      parseInt(p.h || "0") * 10;

    if (ms === 0) return;

    if (currentRes && currentRes.timing === ms) return;

    await onSave(studentId, ms);
  };

  const studentId = getResultStudentId(student);
  const res = student
    ? findStudentResult(allResults, eventName, student)
    : null;
  const isSaving = student && savingId === studentId;

  return (
    <div className="flex border-b border-black last:border-0 h-9 transition-colors hover:bg-slate-50/50">
      <div className="w-12 border-r border-black p-1 flex items-center justify-center font-bold text-neutral-800">
        {laneIndex + 1}
      </div>
      <div className="flex-1 border-r border-black p-1 flex items-center px-3 font-medium text-neutral-900 truncate">
        {isRelayEvent
          ? displayFaculty(student?.faculty) || ""
          : student?.name || ""}
      </div>
      {!isRelayEvent && (
        <div className="w-24 border-r border-black p-1 flex items-center justify-center font-medium text-neutral-900">
          {displayFaculty(student?.faculty) || ""}
        </div>
      )}
      <div className="w-24 border-r border-black p-1 flex items-center justify-center gap-0.5 bg-slate-50/30 relative">
        {student ? (
          <>
            {!res && !localInputs.m && !localInputs.s && !localInputs.h && (
              <span className="absolute text-xs font-semibold text-muted-foreground pointer-events-none">
                NT
              </span>
            )}
            <Input
              className="w-6 h-5 p-0 text-center md:text-xs font-medium border-none bg-transparent focus-visible:ring-1 outline-none"
              placeholder="0"
              value={localInputs.m}
              onChange={(e) => updateInput("m", e.target.value)}
              onBlur={handleBlur}
            />
            <span className="opacity-20 font-bold">:</span>
            <Input
              className="w-6 h-5 p-0 text-center md:text-xs font-medium border-none bg-transparent focus-visible:ring-1 outline-none"
              placeholder="00"
              value={localInputs.s}
              onChange={(e) => updateInput("s", e.target.value)}
              onBlur={handleBlur}
            />
            <span className="opacity-20 font-bold">.</span>
            <Input
              className="w-6 h-5 p-0 text-center md:text-xs font-medium border-none bg-transparent focus-visible:ring-1 outline-none"
              placeholder="00"
              value={localInputs.h}
              onChange={(e) => updateInput("h", e.target.value)}
              onBlur={handleBlur}
            />
          </>
        ) : null}
      </div>
      <div className="w-16 border-r border-black p-1 flex items-center justify-center font-medium text-neutral-900">
        {isSaving ? "..." : res?.rank || ""}
      </div>
      <div className="w-16 border-black p-1 flex items-center justify-center font-medium text-neutral-900">
        {res?.points || ""}
      </div>
    </div>
  );
}

// --- Main Component ---

interface HeatTablesProps {
  meet: {
    name: string;
    events: string[];
  };
  registrations: MeetProgramRegistration[];
  orderedEvents: string[];
  allResults: MeetResult[];
  onSave: (eventName: string, studentId: string, ms: number) => Promise<void>;
  onClear: (eventName: string, studentId: string) => Promise<void>;
  savingId: string | null;
}

export function HeatTables({
  meet,
  registrations,
  orderedEvents,
  allResults,
  onSave,
  onClear,
  savingId,
}: HeatTablesProps) {
  const eventsData = useMemo(
    () => buildMeetProgramEvents(registrations, orderedEvents),
    [registrations, orderedEvents],
  );

  return (
    <div
      id="printable-content"
      className="mx-auto max-w-[210mm] min-h-[297mm] bg-white shadow-lg print:shadow-none p-10 print:p-0 print:m-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b-2 border-black pb-6 print:mb-4">
        <div className="w-20 h-20 flex items-center justify-center">
          <Image
            src="/university-logo.svg"
            alt="University Logo"
            className="w-full h-full object-contain"
            width={80}
            height={80}
          />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-wide uppercase text-neutral-950">
            {meet?.name || "Meet Name"}
          </h1>
          <p className="text-sm font-semibold mt-1 text-neutral-600 uppercase tracking-[0.2em]">
            Timings
          </p>
        </div>

        <div className="w-20 h-20 flex items-center justify-center">
          <Image
            src="/swimming-logo.svg"
            alt="Swimming Logo"
            className="w-full h-full object-contain"
            width={80}
            height={80}
          />
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-10 print:space-y-8">
        {eventsData.map((event) => {
          const isRelayEvent = event.name.toLowerCase().includes("relay");
          return (
            <div key={event.name} className="break-inside-avoid">
              {/* Event Header */}
              <div className="mb-4">
                <div className="border border-black border-b-0 inline-block px-3 py-1 font-bold text-sm bg-neutral-100 print:bg-neutral-100 print:print-color-adjust-exact">
                  Event No: {String(event.number).padStart(2, "0")}
                </div>
                <div className="border border-black px-3 py-2 font-bold text-lg bg-white">
                  Event: {event.name}
                </div>
              </div>

              {/* Groups (Men/Women) */}
              {event.groups.map((group, groupIndex) => (
                <div key={groupIndex} className="mt-4">
                  {group.label && (
                    <h3 className="font-bold text-md mb-2 uppercase tracking-wide text-neutral-800 border-b border-black w-max pb-0.5">
                      {group.label}
                    </h3>
                  )}

                  {/* Heats for this group */}
                  {group.heats.map((heat, heatIndex) => (
                    <div key={heatIndex} className="mt-4 text-sm first:mt-2">
                      <div className="font-bold mb-1 pl-1 text-neutral-700">
                        Heat {String(heatIndex + 1).padStart(2, "0")}
                      </div>
                      <div className="w-full border border-black text-left text-xs">
                        {/* Table Header */}
                        <div className="flex border-b border-black font-bold bg-neutral-100 print:bg-neutral-100 print:print-color-adjust-exact text-neutral-900">
                          <div className="w-12 border-r border-black p-2 text-center">
                            Lane
                          </div>
                          <div className="flex-1 border-r border-black p-2">
                            {isRelayEvent ? "Team" : "Name"}
                          </div>
                          {!isRelayEvent && (
                            <div className="w-24 border-r border-black p-2 text-center">
                              Team
                            </div>
                          )}
                          <div className="w-24 border-r border-black p-2 text-center">
                            Timing
                          </div>
                          <div className="w-16 border-r border-black p-2 text-center">
                            Place
                          </div>
                          <div className="w-16 p-2 text-center">Points</div>
                        </div>

                        {/* Rows */}
                        {Array.from({ length: LANES_PER_HEAT }).map(
                          (_, laneIndex) => {
                            const student = heat[laneIndex];
                            return (
                              <StudentRow
                                key={laneIndex}
                                student={student}
                                eventName={event.name}
                                isRelayEvent={isRelayEvent}
                                allResults={allResults}
                                onSave={(studentId, ms) =>
                                  onSave(event.name, studentId, ms)
                                }
                                onClear={(studentId) =>
                                  onClear(event.name, studentId)
                                }
                                savingId={savingId}
                                laneIndex={laneIndex}
                              />
                            );
                          },
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Empty state fallback */}
              {event.groups.length === 0 && (
                <div className="text-center py-2 text-muted-foreground italic text-xs">
                  No participants registered
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
