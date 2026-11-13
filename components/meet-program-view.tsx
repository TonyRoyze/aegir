"use client";

import { HeatTables } from "@/components/HeatTables";
import type { MeetProgramDocumentData } from "@/lib/meet-program-pdf";

type Props = Omit<MeetProgramDocumentData, "meet"> & {
  meet: MeetProgramDocumentData["meet"] | null;
};

export function MeetProgramView({ meet, registrations, orderedEvents }: Props) {
  if (!meet) {
    return (
      <p className="text-muted-foreground">
        Select a meet to view its start list.
      </p>
    );
  }

  return (
    <HeatTables
      meet={meet}
      registrations={registrations}
      orderedEvents={orderedEvents}
      allResults={[]}
      readOnly
      title="Start List"
    />
  );
}
