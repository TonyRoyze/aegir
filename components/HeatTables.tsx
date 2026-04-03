"use client"

import { useMemo, useState, useEffect } from "react"
import Image from "next/image"
import { Input } from "@/components/ui/input"

const LANES_PER_HEAT = 6;

// --- Helpers ---

const getParts = (ms: number | undefined | null) => {
  if (ms === undefined || ms === null || ms === 0) return { m: "", s: "", h: "" };
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const hundredths = Math.floor((ms % 1000) / 10);
  return {
    m: minutes.toString(),
    s: seconds.toString().padStart(2, '0'),
    h: hundredths.toString().padStart(2, '0')
  };
};

// --- Row Component ---

function StudentRow({ 
  student, 
  eventName, 
  allResults, 
  onSave, 
  savingId, 
  laneIndex 
}: {
  student: any;
  eventName: string;
  allResults: any[];
  onSave: (studentId: string, ms: number) => Promise<void>;
  savingId: string | null;
  laneIndex: number;
}) {
  const [localInputs, setLocalInputs] = useState<{ m: string, s: string, h: string }>({ m: "", s: "", h: "" });

  useEffect(() => {
    if (!student) return;
    const studentId = student.id || student._id;
    const res = allResults?.find(r => r.event === eventName && r.studentId === studentId);
    if (res) {
      setLocalInputs(getParts(res.timing));
    } else {
      setLocalInputs({ m: "", s: "", h: "" });
    }
  }, [allResults, student, eventName]);

  const updateInput = (field: 'm' | 's' | 'h', val: string) => {
    if (val && !/^\d+$/.test(val)) return;
    if (field !== 'm' && val.length > 2) return;
    setLocalInputs(prev => ({ ...prev, [field]: val }));
  };

  const handleBlur = async () => {
    if (!student) return;
    const studentId = student.id || student._id;
    const p = localInputs;
    if (p.m === "" && p.s === "" && p.h === "") return;

    const ms = (parseInt(p.m || '0') * 60000) +
      (parseInt(p.s || '0') * 1000) +
      (parseInt(p.h || '0') * 10);

    if (ms === 0) return;

    const currentRes = allResults?.find(r => r.event === eventName && r.studentId === studentId);
    if (currentRes && currentRes.timing === ms) return;

    await onSave(studentId, ms);
  };

  const studentId = student?.id || student?._id;
  const res = student ? allResults?.find(r => r.event === eventName && r.studentId === studentId) : null;
  const isSaving = student && savingId === studentId;

  return (
    <div className="flex border-b border-black last:border-0 h-9 transition-colors hover:bg-slate-50/50">
      <div className="w-12 border-r border-black p-1 flex items-center justify-center font-bold text-neutral-800">{laneIndex + 1}</div>
      <div className="flex-1 border-r border-black p-1 flex items-center px-3 font-medium text-neutral-900 truncate">
        {student?.name || ""}
      </div>
      <div className="w-24 border-r border-black p-1 flex items-center justify-center font-medium text-neutral-900">
        {student?.faculty || ""}
      </div>
      <div className="w-24 border-r border-black p-1 flex items-center justify-center gap-0.5 bg-slate-50/30">
        {student ? (
          <>
            <Input
              className="w-6 h-5 p-0 text-center md:text-xs font-medium border-none bg-transparent focus-visible:ring-1 outline-none"
              placeholder="0"
              value={localInputs.m}
              onChange={(e) => updateInput('m', e.target.value)}
              onBlur={handleBlur}
            />
            <span className="opacity-20 font-bold">:</span>
            <Input
              className="w-6 h-5 p-0 text-center md:text-xs font-medium border-none bg-transparent focus-visible:ring-1 outline-none"
              placeholder="00"
              value={localInputs.s}
              onChange={(e) => updateInput('s', e.target.value)}
              onBlur={handleBlur}
            />
            <span className="opacity-20 font-bold">.</span>
            <Input
              className="w-6 h-5 p-0 text-center md:text-xs font-medium border-none bg-transparent focus-visible:ring-1 outline-none"
              placeholder="00"
              value={localInputs.h}
              onChange={(e) => updateInput('h', e.target.value)}
              onBlur={handleBlur}
            />
          </>
        ) : null}
      </div>
      <div className="w-16 border-r border-black p-1 flex items-center justify-center font-medium text-neutral-900">
        {isSaving ? "..." : (res?.rank || "")}
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
  registrations: any[];
  orderedEvents: string[];
  allResults: any[];
  onSave: (eventName: string, studentId: string, ms: number) => Promise<void>;
  savingId: string | null;
}

export function HeatTables({ meet, registrations, orderedEvents, allResults, onSave, savingId }: HeatTablesProps) {
  // Group detailed students by event
  const eventsData = useMemo(() => {
    if (!registrations || !orderedEvents) return [];

    // Map: EventName -> Student[]
    const map = new Map<string, any[]>();

    // Initialize map with empty arrays for all events
    orderedEvents.forEach(e => map.set(e, []));

    registrations.forEach(reg => {
      reg.events.forEach((eventName: string) => {
        if (map.has(eventName)) {
          map.get(eventName)?.push(reg.student);
        }
      });
    });

    return orderedEvents.map((eventName, index) => {
      const allParticipants = map.get(eventName) || [];
      const isRelay = eventName.toLowerCase().includes("relay");

      let studentsToProcess = allParticipants;
      
      if (isRelay) {
        // For relays, we group by faculty to show one row per team
        const facultyTeams = new Map<string, any>();
        allParticipants.forEach(s => {
          const faculty = s.faculty || "Unknown";
          if (!facultyTeams.has(faculty)) {
            facultyTeams.set(faculty, {
              _id: faculty, // Use faculty as ID for timing/results
              name: faculty,
              faculty: faculty,
              gender: s.gender, // Carry over gender for grouping
              isRelay: true
            });
          }
        });
        studentsToProcess = Array.from(facultyTeams.values());
      }

      // Split by gender
      const men = studentsToProcess.filter((s: any) => s.gender === 'Male');
      const women = studentsToProcess.filter((s: any) => s.gender === 'Female');

      const groups: { label: string; heats: any[][] }[] = [];

      // Sort and chunk helper
      const processGroup = (groupStudents: any[], label: string) => {
        const sorted = [...groupStudents].sort((a: any, b: any) => a.name.localeCompare(b.name));
        const heats = [];
        if (sorted.length > 0) {
          for (let i = 0; i < sorted.length; i += LANES_PER_HEAT) {
            heats.push(sorted.slice(i, i + LANES_PER_HEAT));
          }
        }
        if (heats.length > 0) {
          groups.push({ label, heats });
        }
      };

      // Order: Women then Men
      if (women.length > 0) processGroup(women, "Women");
      if (men.length > 0) processGroup(men, "Men");

      // Fallback
      if (studentsToProcess.length === 0) {
        groups.push({ label: "", heats: [[]] });
      } else if (groups.length === 0) {
        const others = studentsToProcess.filter((s: any) => s.gender !== 'Male' && s.gender !== 'Female');
        if (others.length > 0) processGroup(others, "Participants");
      }

      return {
        name: eventName,
        number: index + 1,
        groups
      };
    });

  }, [orderedEvents, registrations]);

  return (
    <div id="printable-content" className="mx-auto max-w-[210mm] min-h-[297mm] bg-white shadow-lg print:shadow-none p-10 print:p-0 print:m-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b-2 border-black pb-6 print:mb-4">
        <div className="w-20 h-20 flex items-center justify-center">
          <Image src="/university-logo.svg" alt="University Logo" className="w-full h-full object-contain" width={80} height={80} />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-wide uppercase text-neutral-950">{meet?.name || "Meet Name"}</h1>
          <p className="text-sm font-semibold mt-1 text-neutral-600 uppercase tracking-[0.2em]">Timings</p>
        </div>

        <div className="w-20 h-20 flex items-center justify-center">
          <Image src="/swimming-logo.svg" alt="Swimming Logo" className="w-full h-full object-contain" width={80} height={80} />
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-10 print:space-y-8">
        {eventsData.map((event) => (
          <div key={event.name} className="break-inside-avoid">
            {/* Event Header */}
            <div className="mb-4">
              <div className="border border-black border-b-0 inline-block px-3 py-1 font-bold text-sm bg-neutral-100 print:bg-neutral-100 print:print-color-adjust-exact">
                Event No: {String(event.number).padStart(2, '0')}
              </div>
              <div className="border border-black px-3 py-2 font-bold text-lg bg-white">
                Event: {event.name}
              </div>
            </div>

            {/* Groups (Men/Women) */}
            {event.groups.map((group, groupIndex) => (
              <div key={groupIndex} className="mt-4">
                {group.label && (
                  <h3 className="font-bold text-md mb-2 uppercase tracking-wide text-neutral-800 border-b border-black w-max pb-0.5">{group.label}</h3>
                )}

                {/* Heats for this group */}
                {group.heats.map((heat, heatIndex) => (
                  <div key={heatIndex} className="mt-4 text-sm first:mt-2">
                    <div className="font-bold mb-1 pl-1 text-neutral-700">Heat {String(heatIndex + 1).padStart(2, '0')}</div>
                    <div className="w-full border border-black text-left text-xs">
                      {/* Table Header */}
                      <div className="flex border-b border-black font-bold bg-neutral-100 print:bg-neutral-100 print:print-color-adjust-exact text-neutral-900">
                        <div className="w-12 border-r border-black p-2 text-center">Lane</div>
                        <div className="flex-1 border-r border-black p-2">Name</div>
                        <div className="w-24 border-r border-black p-2 text-center">Faculty</div>
                        <div className="w-24 border-r border-black p-2 text-center">Timing</div>
                        <div className="w-16 border-r border-black p-2 text-center">Place</div>
                        <div className="w-16 p-2 text-center">Points</div>
                      </div>

                      {/* Rows */}
                      {Array.from({ length: LANES_PER_HEAT }).map((_, laneIndex) => {
                        const student = heat[laneIndex];
                        return (
                          <StudentRow
                            key={laneIndex}
                            student={student}
                            eventName={event.name}
                            allResults={allResults}
                            onSave={(studentId, ms) => onSave(event.name, studentId, ms)}
                            savingId={savingId}
                            laneIndex={laneIndex}
                          />
                        );
                      })}
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
        ))}
      </div>
    </div>
  )
}
