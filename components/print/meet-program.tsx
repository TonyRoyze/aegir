"use client"

import Image from "next/image"

import { EventRestSummary } from "@/lib/event-rest-utils"
import {
  buildMeetProgramEvents,
  MeetProgramRegistration,
} from "@/lib/meet-program-pdf"
import { LANES_PER_HEAT } from "@/lib/swimming-utils"

interface MeetProgramProps {
  meet: {
    name: string;
    events: string[];
  };
  registrations: MeetProgramRegistration[];
  orderedEvents: string[];
  restSummaryByEvent?: Map<string, EventRestSummary>;
}

export function MeetProgram({ meet, registrations, orderedEvents, restSummaryByEvent }: MeetProgramProps) {
  const eventsData = buildMeetProgramEvents(registrations, orderedEvents);

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
          const restSummary = restSummaryByEvent?.get(event.name);
          const hasConflict = Boolean(restSummary && (restSummary.sharedWithPrevious > 0 || restSummary.sharedWithNext > 0));

          return (
            <div key={event.name} className="break-inside-avoid">
            {/* Event Header */}
            <div className="mb-4">
              <div className="border border-black border-b-0 inline-block px-4 py-1 font-bold text-sm bg-neutral-100 print:bg-neutral-100 print:print-color-adjust-exact">
                Event No: {String(event.number).padStart(2, '0')}
              </div>
              <div className={`border px-3 py-2 font-bold text-lg ${
                hasConflict
                  ? "border-red-300 bg-red-50 text-red-900"
                  : "border-black bg-white"
              }`}>
                Event: {event.name}
              </div>
              {hasConflict ? (
                <div className="border border-t-0 border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {restSummary?.sharedWithPrevious ? (
                    <div>
                      {restSummary.sharedWithPrevious} swimmer{restSummary.sharedWithPrevious === 1 ? "" : "s"} also in previous event
                    </div>
                  ) : null}
                  {restSummary?.sharedWithNext ? (
                    <div>
                      {restSummary.sharedWithNext} swimmer{restSummary.sharedWithNext === 1 ? "" : "s"} also in next event
                    </div>
                  ) : null}
                </div>
              ) : null}
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
