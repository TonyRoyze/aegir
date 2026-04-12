"use client"

import { useMemo } from "react"
import Image from "next/image"

import { assignToHeats, LANES_PER_HEAT } from "@/lib/swimming-utils"

interface MeetProgramProps {
  meet: {
    name: string;
    events: string[];
  };
  registrations: any[];
  orderedEvents: string[];
}

export function MeetProgram({ meet, registrations, orderedEvents }: MeetProgramProps) {
  // Group detailed students by event
  const eventsData = useMemo(() => {
    if (!registrations || !orderedEvents) return [];

    // Map: EventName -> Student[]
    const map = new Map<string, any[]>();

    // Initialize map with empty arrays for all events (to show empty events too)
    orderedEvents.forEach(e => map.set(e, []));

    registrations.forEach(reg => {
      reg.events.forEach((eventName: string) => {
        if (map.has(eventName)) {
          map.get(eventName)?.push(reg.student);
        }
      });
    });

    return orderedEvents.map((eventName, index) => {
      const students = map.get(eventName) || [];
      const isRelay = eventName.toLowerCase().includes("relay");

      let studentsToProcess = students;


      if (isRelay) {
        // For relays, we group by faculty to show one row per team
        const facultyTeams = new Map<string, any>();
        students.forEach(s => {
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

      // Balanced heats helper
      const processGroup = (groupStudents: any[], label: string) => {
        const sorted = [...groupStudents].sort((a: any, b: any) => a.name.localeCompare(b.name));
        const heats = assignToHeats(sorted, LANES_PER_HEAT);
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
        {/* Placeholder Logos */}
        <div className="w-20 h-20 flex items-center justify-center">
          <Image src="/university-logo.svg" alt="University Logo" className="w-full h-full object-contain" width={80} height={80} />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-wide uppercase text-neutral-950">{meet?.name || "Meet Name"}</h1>
          <p className="text-sm font-semibold mt-1 text-neutral-600 uppercase tracking-[0.2em]">Start List</p>
        </div>

        <div className="w-20 h-20 flex items-center justify-center">
          <Image src="/swimming-logo.svg" alt="Swimming Logo" className="w-full h-full object-contain" width={80} height={80} />
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
              <div className="border border-black border-b-0 inline-block px-4 py-1 font-bold text-sm bg-neutral-100 print:bg-neutral-100 print:print-color-adjust-exact">
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
                        <div className="flex-1 border-r border-black p-2">{isRelayEvent ? "Faculty" : "Name"}</div>
                        {!isRelayEvent && (
                          <div className="w-24 border-r border-black p-2 text-center">Faculty</div>
                        )}
                        <div className="w-24 border-r border-black p-2 text-center">Timing</div>
                        <div className="w-16 p-2 text-center">Place</div>
                      </div>

                      {/* Rows */}
                      {Array.from({ length: LANES_PER_HEAT }).map((_, laneIndex) => {
                        const student = heat[laneIndex];
                        const rowNum = laneIndex + 1;
                        return (
                          <div key={laneIndex} className="flex border-b border-black last:border-0 h-9">
                            <div className="w-12 border-r border-black p-1 flex items-center justify-center font-bold text-neutral-800">{rowNum}</div>
                            <div className="flex-1 border-r border-black p-1 flex items-center px-3 font-medium text-neutral-900">
                              {isRelayEvent ? (student?.faculty || "") : (student?.name || "")}
                            </div>
                            {!isRelayEvent && (
                              <div className="w-24 border-r border-black p-1 flex items-center justify-center font-medium text-neutral-900">
                                {student?.faculty || ""}
                              </div>
                            )}
                            <div className="w-24 border-r border-black p-1"></div>
                            <div className="w-16 p-1"></div>
                          </div>
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
          );
        })}
      </div>
    </div>
  )
}
