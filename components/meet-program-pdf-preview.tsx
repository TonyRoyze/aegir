"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { MeetProgramDocumentData } from "@/lib/meet-program-pdf";

type Props = Omit<MeetProgramDocumentData, "meet"> & {
  meet: MeetProgramDocumentData["meet"] | null;
};

export function MeetProgramPdfPreview({ meet, registrations, orderedEvents }: Props) {
  const [preview, setPreview] = useState<{ url?: string; error?: string }>({});

  useEffect(() => {
    if (!meet) return;
    let active = true;
    let url: string | undefined;
    // Wait for dragging/reordering to settle before regenerating the document.
    const timer = setTimeout(async () => {
      setPreview({});
      try {
        const { generateMeetProgramPdf } = await import("@/lib/pdf/meet-program");
        const bytes = await generateMeetProgramPdf({ meet, registrations, orderedEvents });
        if (!active) return;
        url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
        setPreview({ url });
      } catch (error) {
        if (active) setPreview({ error: error instanceof Error ? error.message : "Could not generate PDF preview." });
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [meet, registrations, orderedEvents]);

  if (!meet) return <p className="text-center text-muted-foreground">Select a meet to preview its start list.</p>;
  if (preview.error) return <p role="alert" className="text-center text-destructive">{preview.error}</p>;
  if (!preview.url) return <div className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Generating PDF preview...</div>;
  return <iframe src={preview.url} title={`${meet.name} start list PDF preview`} className="h-full min-h-[600px] w-full border-0" />;
}
