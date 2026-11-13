"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { preferredMeetId } from "@/lib/meet-selection";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Loader2, RefreshCcw, Download, Workflow } from "lucide-react";
import { MeetProgramView } from "@/components/meet-program-view";
import { summarizeEventRest } from "@/lib/event-rest-utils";
import { useProgramEventOrder } from "@/lib/use-program-event-order";

export default function EventOrderPage() {
  const [selectedMeetId, setSelectedMeetId] = useState<string | null>(null);
  const meets = useQuery(api.meets.getMeets);
  const registrations = useQuery(
    api.registrations.get,
    selectedMeetId ? { meetId: selectedMeetId as Id<"meets"> } : "skip",
  );
  const generateHeatAssignments = useMutation(
    api.meets.generateHeatAssignments,
  );

  const selectedMeet = meets?.find((m) => m._id === selectedMeetId);
  const orderedEvents = useProgramEventOrder(
    selectedMeetId,
    selectedMeet?.events ?? [],
  );

  // Set initial selected meet
  useEffect(() => {
    if (meets && meets.length > 0 && !selectedMeetId) {
      const requested = new URLSearchParams(window.location.search).get("meet");
      setSelectedMeetId(preferredMeetId(meets, requested) ?? "");
    }
  }, [meets, selectedMeetId]);

  const restSummaries = useMemo(
    () => summarizeEventRest(registrations || [], orderedEvents),
    [orderedEvents, registrations],
  );

  const totalAdjacentConflicts = useMemo(
    () =>
      restSummaries.reduce((sum, summary) => sum + summary.sharedWithNext, 0),
    [restSummaries],
  );

  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!selectedMeet) return;
    // Open during the click so browsers allow the tab before async generation.
    const previewTab = window.open("about:blank", "_blank");
    if (!previewTab) {
      alert("Allow pop-ups for this site to open the PDF preview.");
      return;
    }
    previewTab.opener = null;
    previewTab.document.title = `${selectedMeet.name} - Start List`;
    previewTab.document.body.textContent = "Generating PDF...";
    setDownloading(true);
    try {
      const { generateMeetProgramPdf } = await import("@/lib/pdf/meet-program");
      const bytes = await generateMeetProgramPdf({
        meet: { name: selectedMeet.name, events: selectedMeet.events },
        registrations: registrations || [],
        orderedEvents,
      });
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      );
      if (!previewTab.closed) previewTab.location.replace(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      previewTab.close();
      console.error("PDF generation failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to generate PDF. Please try again.",
      );
    } finally {
      setDownloading(false);
    }
  };

  if (!meets)
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        <Loader2 className="animate-spin mr-2" /> Loading...
      </div>
    );

  return (
    <div className="flex min-h-screen xl:h-screen flex-col-reverse xl:flex-row bg-background font-sans text-neutral-900">
      {/* Left Main Content - Preview Area */}
      <div className="flex-1 overflow-auto bg-slate-100 p-4 xl:p-8">
        <MeetProgramView
          meet={selectedMeet || null}
          registrations={registrations || []}
          orderedEvents={orderedEvents}
        />
      </div>

      {/* Right Sidebar - Control Panel */}
      <div className="w-full xl:w-80 border-l bg-background p-6 flex flex-col gap-6 print:hidden shadow-xl z-10">
        <div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Select Meet
              </label>
              <Select
                value={selectedMeetId || ""}
                onValueChange={setSelectedMeetId}
              >
                {meets?.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">
                    No meets available.
                  </p>
                ) : (
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Meet" />
                  </SelectTrigger>
                )}
                <SelectContent>
                  {meets?.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleDownloadPdf}
              disabled={downloading || !selectedMeet || !registrations}
              className="w-full gap-2 font-semibold shadow-sm"
              size="lg"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloading ? "Generating PDF..." : "Download PDF"}
            </Button>

            <Button
              onClick={() =>
                selectedMeetId &&
                generateHeatAssignments({
                  meetId: selectedMeetId as Id<"meets">,
                })
              }
              disabled={!selectedMeetId}
              variant="outline"
              className="w-full gap-2"
              size="lg"
            >
              <RefreshCcw className="w-4 h-4" />
              Generate Heats
            </Button>

            {selectedMeetId && (
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link
                  href={`/event_order/edit?meet=${encodeURIComponent(selectedMeetId)}`}
                >
                  <Workflow data-icon="inline-start" />
                  Reorder events
                </Link>
              </Button>
            )}

            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                totalAdjacentConflicts > 0
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {totalAdjacentConflicts > 0
                ? `${totalAdjacentConflicts} back-to-back swimmer conflict${totalAdjacentConflicts === 1 ? "" : "s"} detected`
                : "No back-to-back swimmer conflicts in the current order"}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <h3 className="text-sm font-semibold">Running order</h3>
          <ol className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {orderedEvents.map((event, index) => (
              <li
                key={event}
                className="flex items-start gap-3 rounded-md border p-3 text-sm"
              >
                <span className="text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <span>{event}</span>
              </li>
            ))}
          </ol>
          {orderedEvents.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No events found in this meet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
