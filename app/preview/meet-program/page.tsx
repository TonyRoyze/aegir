"use client";

import { useMemo, useSyncExternalStore } from "react";

import { MeetProgram } from "@/components/print/meet-program";
import {
  createDefaultMeetProgramDocument,
  MEET_PROGRAM_STORAGE_KEY,
  type MeetProgramDocumentData,
} from "@/lib/meet-program-pdf";

export default function MeetProgramPreviewPage() {
  const storedDocument = useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      return () => window.removeEventListener("storage", callback);
    },
    () => {
      return window.localStorage.getItem(MEET_PROGRAM_STORAGE_KEY) ?? "";
    },
    () => "",
  );

  const document = useMemo<MeetProgramDocumentData>(() => {
    if (!storedDocument) {
      return createDefaultMeetProgramDocument();
    }

    try {
      return JSON.parse(storedDocument) as MeetProgramDocumentData;
    } catch (error) {
      console.error("Failed to parse meet program preview payload", error);
      return createDefaultMeetProgramDocument();
    }
  }, [storedDocument]);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:p-0">
      <MeetProgram
        meet={document.meet}
        registrations={document.registrations}
        orderedEvents={document.orderedEvents}
      />
    </div>
  );
}
