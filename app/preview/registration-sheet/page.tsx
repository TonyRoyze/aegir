"use client";

import { useMemo, useSyncExternalStore } from "react";

import { RegistrationSheet } from "@/components/print/registration-sheet";
import {
  createDefaultRegistrationSheetDocument,
  REGISTRATION_SHEET_STORAGE_KEY,
  type RegistrationSheetDocumentData,
} from "@/lib/registration-sheet-pdf";

export default function RegistrationSheetPreviewPage() {
  const storedDocument = useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      return () => window.removeEventListener("storage", callback);
    },
    () => window.localStorage.getItem(REGISTRATION_SHEET_STORAGE_KEY) ?? "",
    () => "",
  );

  const document = useMemo<RegistrationSheetDocumentData>(() => {
    if (!storedDocument) {
      return createDefaultRegistrationSheetDocument();
    }

    try {
      return JSON.parse(storedDocument) as RegistrationSheetDocumentData;
    } catch (error) {
      console.error("Failed to parse registration sheet preview payload", error);
      return createDefaultRegistrationSheetDocument();
    }
  }, [storedDocument]);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:p-0">
      <RegistrationSheet
        meet={document.meet}
        registrations={document.registrations}
        filters={document.filters}
      />
    </div>
  );
}
