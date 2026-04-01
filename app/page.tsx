"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Trophy, Users, Waves, ArrowRight, Medal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Id } from "@/convex/_generated/dataModel"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// Helper
const formatTime = (ms: number | undefined | null) => {
  if (ms === undefined || ms === null || ms === 0) return "-";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
};

export default function DashboardPage() {
  const [selectedMeetId, setSelectedMeetId] = useState<string | null>(null)
  const [selectedEventStanding, setSelectedEventStanding] = useState<string>("")

  const stats = useQuery(api.dashboard.getStats, selectedMeetId ? { meetId: selectedMeetId as Id<"meets"> } : "skip")
  const meets = useQuery(api.meets.getMeets)

  const eventResults = useQuery(api.results.getResults,
    selectedMeetId && selectedEventStanding ? { meetId: selectedMeetId as Id<"meets">, event: selectedEventStanding } : "skip"
  )

  const selectedMeet = meets?.find(m => m._id === selectedMeetId);

  const { totalParticipants, totalEntries, facultyLeaderboard, studentLeaderboard } = stats || { totalParticipants: 0, totalEntries: 0, facultyLeaderboard: [], studentLeaderboard: [] }

  return (
    <div className="space-y-8 p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Live Dashboard & Statistics</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Select onValueChange={(value) => setSelectedMeetId(value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a meet" />
            </SelectTrigger>
            <SelectContent>
              {meets?.map((meet) => (
                <SelectItem key={meet._id} value={meet._id}>
                  {meet.name}
                </SelectItem>
              ))}
              {meets?.length === 0 && (
                <SelectItem value="" disabled>No meets available</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button asChild>
            <Link href="/register">
              Register Student <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/timing">Timing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/meets">Manage Meets</Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {selectedMeetId != null ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalParticipants}</div>
                <p className="text-xs text-muted-foreground">Students registered</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Event Entries</CardTitle>
                <Waves className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalEntries}</div>
                <p className="text-xs text-muted-foreground">Individual splashdowns</p>
              </CardContent>
            </Card>
            <Card className="bg-linear-to-br from-primary/10 to-background border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">Top Faculty</CardTitle>
                <Trophy className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {facultyLeaderboard[0]?.name || "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leading with {facultyLeaderboard[0]?.score || 0} entries
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Faculty Leaderboard */}
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Faculty Rankings
                </CardTitle>
                <CardDescription>Based on total points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {facultyLeaderboard.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No data yet</div>
                  ) : (
                    facultyLeaderboard.map((faculty, index) => (
                      <div key={faculty.name} className="flex items-center gap-4">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs ring-2 ring-transparent",
                          index === 0 ? "bg-amber-100 text-amber-700 ring-amber-200" :
                            index === 1 ? "bg-slate-100 text-slate-700 ring-slate-200" :
                              index === 2 ? "bg-orange-100 text-orange-800 ring-orange-200" :
                                "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-sm font-medium">
                            <span>{faculty.name}</span>
                            <span className="text-muted-foreground">{faculty.score}</span>
                          </div>
                          {/* Simple Progress Bar */}
                          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-500"
                              style={{ width: `${(faculty.score / (facultyLeaderboard[0]?.score || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Student Leaderboard */}
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Medal className="h-5 w-5 text-blue-500" />
                  Top Participants
                </CardTitle>
                <CardDescription>Students with most points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {studentLeaderboard.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No students registered</div>
                  ) : (
                    studentLeaderboard.map((student, index) => (
                      <div key={student.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full font-bold text-[10px]",
                            index === 0 ? "bg-amber-100 text-amber-700" :
                              index === 1 ? "bg-slate-100 text-slate-700" :
                                index === 2 ? "bg-orange-100 text-orange-800" :
                                  "bg-muted text-muted-foreground"
                          )}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium leading-none">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.faculty}</p>
                          </div>
                        </div>
                        <div className="font-semibold text-sm">
                          {student.score} <span className="text-xs font-normal text-muted-foreground ml-1">points</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Event Standings */}
          <Card className="mt-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-blue-500" />
                    Event Standings
                  </CardTitle>
                  <CardDescription>View results by event</CardDescription>
                </div>
                <div className="w-[200px]">
                  <Select value={selectedEventStanding} onValueChange={setSelectedEventStanding}>
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
              </div>
            </CardHeader>
            <CardContent>
              {selectedEventStanding ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Faculty</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventResults === undefined ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></TableCell>
                      </TableRow>
                    ) : eventResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No results recorded yet</TableCell>
                      </TableRow>
                    ) : (
                      eventResults.map((result) => (
                        <TableRow key={result._id}>
                          <TableCell className="font-bold text-lg">
                            {result.rank === 1 ? '🥇' : result.rank === 2 ? '🥈' : result.rank === 3 ? '🥉' : result.rank}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{result.student?.name}</div>
                            <div className="text-xs text-muted-foreground">{result.student?.registrationNumber}</div>
                          </TableCell>
                          <TableCell>{result.student?.faculty}</TableCell>
                          <TableCell className="text-right font-mono">{formatTime(result.timing)}</TableCell>
                          <TableCell className="text-right font-bold">{result.points}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  Select an event to view standings
                </div>
              )}
            </CardContent>
          </Card>
        </>) : (
        <div className="text-center py-8 text-muted-foreground">Select a meet to view stats</div>
      )}
    </div>
  )
}
