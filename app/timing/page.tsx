"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HeatTables } from "@/components/HeatTables"
import { FacultyLeaderboard } from "@/components/FacultyLeaderboard"
import { loadProgramEventOrder } from "@/lib/program-event-order"

// --- Main Page ---

export default function TimingPage() {
  const [selectedMeetId, setSelectedMeetId] = useState<string>("");
  const meets = useQuery(api.meets.getMeets);
  const selectedMeet = meets?.find(m => m._id === selectedMeetId);

  const registrations = useQuery(api.registrations.get, selectedMeetId ? { meetId: selectedMeetId as Id<"meets"> } : "skip");
  const allResults = useQuery(api.results.getMeetResults, selectedMeetId ? { meetId: selectedMeetId as Id<"meets"> } : "skip");
  const saveResult = useMutation(api.results.saveResult);

  const [savingId, setSavingId] = useState<string | null>(null);
  const orderedEvents = selectedMeet
    ? loadProgramEventOrder(selectedMeet._id, selectedMeet.events)
    : [];

  useEffect(() => {
    if (meets && meets.length > 0 && !selectedMeetId) {
      const active = meets.find(m => m.status === 'active');
      setSelectedMeetId(active?._id || meets[0]._id);
    }
  }, [meets, selectedMeetId]);

  const handleSave = async (eventName: string, studentId: string, ms: number) => {
    setSavingId(studentId);
    try {
      await saveResult({
        meetId: selectedMeetId as Id<"meets">,
        studentId: studentId,
        event: eventName,
        timing: ms
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  };

  if (!meets) return <div className="p-20 text-center"><Loader2 className="animate-spin inline mr-2 text-primary" /></div>;

  return (
    <div className="flex h-screen bg-background font-sans text-neutral-900">

      {/* Left Main Content - Preview Area */}
      <div className="flex-1 overflow-auto bg-slate-100 p-8 hidden xl:block custom-scrollbar">
        <HeatTables
          meet={selectedMeet || { name: 'Meet Name', events: [] }}
          registrations={registrations || []}
          orderedEvents={orderedEvents}
          allResults={allResults || []}
          onSave={handleSave}
          savingId={savingId}
        />
      </div>
      {/* Right Sidebar - Control Panel */}
      <div className="w-full xl:w-80 border-l bg-background p-6 flex flex-col gap-6 print:hidden shadow-xl z-10">
        <div>
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

        <div className="flex flex-col gap-6">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Faculty Leaderboard</label>
          <FacultyLeaderboard allResults={allResults || []} />
        </div>
      </div>
    </div>

  )
}
