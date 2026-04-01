"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Save, Timer } from "lucide-react"
import { cn } from "@/lib/utils"

// Helper to convert ms to display string (mm:ss.ms)
// e.g. 62340 -> "1:02.34"
const formatTime = (ms: number | undefined | null) => {
  if (ms === undefined || ms === null || ms === 0) return "";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
};

// Helper to parse display string to ms
// e.g. "1:02.34" -> 62340
const parseTime = (input: string): number | null => {
  if (!input) return null;
  // Try various formats
  // 1. mm:ss.ms (1:02.34)
  // 2. ss.ms (59.12)
  const parts = input.split(':');
  let minutes = 0;
  let seconds = 0;
  let hundredths = 0;

  if (parts.length === 2) {
    minutes = parseInt(parts[0]) || 0;
    const secParts = parts[1].split('.');
    seconds = parseInt(secParts[0]) || 0;
    hundredths = parseInt(secParts[1] || '0') || 0;
  } else if (parts.length === 1) {
    const secParts = parts[0].split('.');
    seconds = parseInt(secParts[0]) || 0;
    hundredths = parseInt(secParts[1] || '0') || 0;
  }

  // Adjust precision if user entered 1 chars for ms
  if (input.includes('.') && input.split('.')[1].length === 1) {
    hundredths *= 10;
  }

  return (minutes * 60000) + (seconds * 1000) + (hundredths * 10);
};

export default function TimingPage() {
  const [selectedMeetId, setSelectedMeetId] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<string>("");

  const meets = useQuery(api.meets.getMeets);
  const selectedMeet = meets?.find(m => m._id === selectedMeetId);

  // Get all registrations for this meet (optimally filter by event in backend, but this works for now)
  const registrations = useQuery(api.registrations.get, selectedMeetId ? { meetId: selectedMeetId as Id<"meets"> } : "skip");

  // Get existing results
  const results = useQuery(api.results.getResults,
    selectedMeetId && selectedEvent ? { meetId: selectedMeetId as Id<"meets">, event: selectedEvent } : "skip"
  );

  const saveResult = useMutation(api.results.saveResult);

  // Filter students enrolled in the selected event
  // Filter students enrolled in the selected event
  const eligibleStudents = useMemo(() => registrations?.filter((reg: any) =>
    reg.events.includes(selectedEvent)
  ) || [], [registrations, selectedEvent]);

  // Local state for inputs to avoid jitter while typing
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Sync inputs with DB results when they load/change
  useEffect(() => {
    if (eligibleStudents && results) {
      const newInputs: Record<string, string> = {};
      eligibleStudents.forEach((reg: any) => {
        const result = results.find(r => r.studentId === reg.student.id);
        if (result) {
          newInputs[reg.student.id] = formatTime(result.timing);
        }
      });
      setInputs(prev => ({ ...prev, ...newInputs }));
    }
  }, [results, eligibleStudents]); // careful not to overwrite user typing, maybe only on mount/selection change? 
  // Actually simplest is: inputs are controlled. onBlur -> parse -> save -> refetch -> update inputs (formatted).

  // Auto-select first meet
  useEffect(() => {
    if (meets && meets.length > 0 && !selectedMeetId) {
      const active = meets.find(m => m.status === 'active');
      setSelectedMeetId(active?._id || meets[0]._id);
    }
  }, [meets, selectedMeetId]);

  const handleSave = async (studentId: string, value: string) => {
    const ms = parseTime(value);
    if (ms === null) return; // invalid or empty

    setSavingId(studentId);
    try {
      await saveResult({
        meetId: selectedMeetId as Id<"meets">,
        studentId: studentId as Id<"students">,
        event: selectedEvent,
        timing: ms
      });
      // Input will automatically format correctly when query refreshes
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  };

  const currentResults = results || [];

  return (
    <div className="p-6 md:p-8 space-y-8 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Event Timing</h1>
        <p className="text-muted-foreground">Enter results for each event. Rankings are calculated automatically.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-64 space-y-2">
          <label className="text-sm font-medium">Select Meet</label>
          <Select value={selectedMeetId} onValueChange={setSelectedMeetId}>
            <SelectTrigger>
              <SelectValue placeholder="Select Meet" />
            </SelectTrigger>
            <SelectContent>
              {meets?.map(m => (
                <SelectItem key={m._id} value={m._id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedMeetId && (
          <div className="w-full md:w-64 space-y-2">
            <label className="text-sm font-medium">Select Event</label>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger>
                <SelectValue placeholder="Select Event" />
              </SelectTrigger>
              <SelectContent>
                {selectedMeet?.events?.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {selectedEvent && (
        <Card className="min-h-[500px]">
          <CardHeader>
            <CardTitle>{selectedEvent}</CardTitle>
            <CardDescription>
              {eligibleStudents.length} participant{eligibleStudents.length !== 1 && 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Faculty</TableHead>
                  <TableHead className="w-48">Time (mm:ss.ms)</TableHead>
                  <TableHead className="w-24 text-right">Points</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligibleStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No students registered for this event.
                    </TableCell>
                  </TableRow>
                ) : (
                  eligibleStudents.map((reg: any) => {
                    const result = currentResults.find(r => r.studentId === reg.student.id);
                    const isSaving = savingId === reg.student.id;

                    return (
                      <TableRow key={reg.student.id} className={cn(result ? "bg-green-50/50" : "")}>
                        <TableCell className="font-bold text-lg">
                          {result?.rank ? `#${result.rank}` : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{reg.student.name}</div>
                          <div className="text-xs text-muted-foreground">{reg.student.registrationNumber}</div>
                        </TableCell>
                        <TableCell>{reg.student.faculty || "-"}</TableCell>
                        <TableCell>
                          <div className="relative">
                            <Input
                              placeholder="0:00.00"
                              className="font-mono"
                              value={inputs[reg.student.id] || ""}
                              onChange={(e) => setInputs(prev => ({ ...prev, [reg.student.id]: e.target.value }))}
                              onBlur={(e) => handleSave(reg.student.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave(reg.student.id, (e.target as HTMLInputElement).value);
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-muted-foreground">
                          {result?.points ? `${result.points} pts` : "-"}
                        </TableCell>
                        <TableCell>
                          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
