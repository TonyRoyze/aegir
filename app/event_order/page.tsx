"use client"

import React, { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2, RefreshCcw, Download } from "lucide-react"
import { MeetProgram } from "@/components/print/meet-program"

// Sortable Item Component
function SortableEventItem({ id, name }: { id: string, name: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 border rounded-md mb-2 group hover:border-primary/50 transition-colors bg-card">
      <button {...attributes} {...listeners} className="cursor-grab hover:bg-muted p-1 rounded active:cursor-grabbing touch-none">
        <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
      </button>
      <span className="text-sm font-medium truncate flex-1">{name}</span>
    </div>
  );
}

export default function EventOrderPage() {
  const [selectedMeetId, setSelectedMeetId] = useState<string | null>(null);
  const meets = useQuery(api.meets.getMeets);
  const registrations = useQuery(api.registrations.get, selectedMeetId ? { meetId: selectedMeetId as Id<"meets"> } : "skip");
  const heatAssignments = useQuery(api.meets.getHeatAssignments, selectedMeetId ? { meetId: selectedMeetId as Id<"meets"> } : "skip");
  const updateEvents = useMutation(api.meets.updateEvents);
  const generateHeatAssignments = useMutation(api.meets.generateHeatAssignments);

  // Derive local state for optimistic updates or just to handle sorting
  const [orderedEvents, setOrderedEvents] = useState<string[]>([]);

  // Set initial selected meet
  useEffect(() => {
    if (meets && meets.length > 0 && !selectedMeetId) {
      // Prefer active meet or first one
      const active = meets.find(m => m.status === 'active') || meets[0];
      setSelectedMeetId(active._id);
    }
  }, [meets, selectedMeetId]);

  // Sync ordered events when selected meet changes
  const selectedMeet = meets?.find(m => m._id === selectedMeetId);
  useEffect(() => {
    if (selectedMeet) {
      setOrderedEvents(selectedMeet.events);
    }
  }, [selectedMeet]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedEvents.indexOf(active.id as string);
      const newIndex = orderedEvents.indexOf(over.id as string);

      const newOrder = arrayMove(orderedEvents, oldIndex, newIndex);
      setOrderedEvents(newOrder);

      // Persist to backend
      if (selectedMeetId) {
        await updateEvents({ id: selectedMeetId as Id<"meets">, events: newOrder });
      }
    }
  };

  const handleResetOrder = () => {
    if (selectedMeet) {
      setOrderedEvents(selectedMeet.events);
    }
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!selectedMeet) return;
    setDownloading(true);
    try {
      const response = await fetch('/api/meet-program-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meet: {
            name: selectedMeet.name,
            events: selectedMeet.events,
          },
          registrations: registrations || [],
          orderedEvents,
        }),
      });

      if (!response.ok) {
        throw new Error(`PDF request failed with status ${response.status}`);
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedMeet.name} - Start List.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };


  if (!meets) return <div className="flex items-center justify-center min-h-screen text-muted-foreground"><Loader2 className="animate-spin mr-2" /> Loading...</div>;

  return (
    <div className="flex h-screen bg-background font-sans text-neutral-900">
      {/* Left Main Content - Preview Area */}
      <div className="flex-1 overflow-auto bg-slate-100 p-8 hidden xl:block print:block print:p-0 print:bg-white custom-scrollbar">
        <MeetProgram
          meet={selectedMeet || { name: 'Meet Name', events: [] }}
          registrations={registrations || []}
          orderedEvents={orderedEvents}
        />
      </div>

      {/* Right Sidebar - Control Panel */}
      <div className="w-full xl:w-80 border-l bg-background p-6 flex flex-col gap-6 print:hidden shadow-xl z-10">
        <div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Meet</label>
              <Select value={selectedMeetId || ""} onValueChange={setSelectedMeetId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Meet" />
                </SelectTrigger>
                <SelectContent>
                  {meets.map(m => (
                    <SelectItem key={m._id} value={m._id}>{m.name}</SelectItem>
                  ))}
                  {meets.length === 0 && <SelectItem value="" disabled>No meets found</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleDownloadPdf}
              disabled={downloading || !selectedMeet}
              className="w-full gap-2 font-semibold shadow-sm"
              size="lg"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloading ? 'Generating PDF...' : 'Download PDF'}
            </Button>

            <Button
              onClick={() => selectedMeetId && generateHeatAssignments({ meetId: selectedMeetId as Id<"meets"> })}
              disabled={!selectedMeetId}
              variant="outline"
              className="w-full gap-2"
              size="lg"
            >
              <RefreshCcw className="w-4 h-4" />
              Generate Heats
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Events Order</h3>
            <span className="text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">Drag to Reorder</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleResetOrder()}
              title="Reset Order">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedEvents}
                strategy={verticalListSortingStrategy}
              >
                {orderedEvents.map((event) => (
                  <SortableEventItem key={event} id={event} name={event} />
                ))}
              </SortableContext>
            </DndContext>

            {orderedEvents.length === 0 && (
              <div className="text-sm text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                No events found in this meet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
