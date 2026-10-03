"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { displayFaculty } from "@/lib/swimming-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Trophy, Users, Waves, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

import { preferredMeetId } from "@/lib/meet-selection";
import { formatTime } from "@/lib/time";

const formatLeaderboardRank = (index: number) => {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return index + 1;
};

function TeamRankingCard({
  title,
  description,
  entries,
  color,
}: {
  title: string;
  description: string;
  entries: { name: string; score: number }[];
  color: string;
}) {
  const total = entries.reduce((sum, entry) => sum + entry.score, 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className={cn("h-5 w-5", color)} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No data yet
            </div>
          ) : (
            entries.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center font-bold text-xs",
                    index <= 2 ? "text-2xl" : "text-muted-foreground",
                  )}
                >
                  {formatLeaderboardRank(index)}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{displayFaculty(entry.name)}</span>
                    <span className="text-muted-foreground text-xs font-semibold">
                      {entry.score} / {total}
                    </span>
                  </div>
                  <Progress
                    value={(entry.score / (total || 1)) * 100}
                    className="h-2"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [selectedMeetId, setSelectedMeetId] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<"Male" | "Female">(
    "Male",
  );
  const [selectedEventStanding, setSelectedEventStanding] =
    useState<string>("");

  const genderPrefix = selectedGender === "Male" ? "M:" : "W:";
  const meets = useQuery(api.meets.getMeets);

  const effectiveSelectedMeetId = preferredMeetId(meets, selectedMeetId);

  const stats = useQuery(
    api.dashboard.getStats,
    effectiveSelectedMeetId
      ? { meetId: effectiveSelectedMeetId as Id<"meets"> }
      : "skip",
  );

  const eventResults = useQuery(
    api.results.getResults,
    effectiveSelectedMeetId && selectedEventStanding
      ? {
          meetId: effectiveSelectedMeetId as Id<"meets">,
          event: selectedEventStanding,
        }
      : "skip",
  );

  const selectedMeet = meets?.find((m) => m._id === effectiveSelectedMeetId);

  const totalParticipants = stats?.totalParticipants ?? 0;
  const totalEntries = stats?.totalEntries ?? 0;
  const facultyLeaderboard = stats?.facultyLeaderboard ?? [];
  const facultyLeaderboardMale = stats?.facultyLeaderboardMale ?? [];
  const facultyLeaderboardFemale = stats?.facultyLeaderboardFemale ?? [];
  const studentLeaderboard = stats?.studentLeaderboard ?? [];

  return (
    <div className="space-y-8 p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Live Dashboard & Statistics
            </h1>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Select
            value={selectedMeetId || ""}
            onValueChange={(value) => setSelectedMeetId(value)}
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
              {meets?.map((meet) => (
                <SelectItem key={meet._id} value={meet._id}>
                  {meet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      {selectedMeetId != null ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Participants
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalParticipants}</div>
                <p className="text-xs text-muted-foreground">
                  Students registered
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Event Entries
                </CardTitle>
                <Waves className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalEntries}</div>
                <p className="text-xs text-muted-foreground">Individual</p>
              </CardContent>
            </Card>
            <Card className="bg-linear-to-br from-primary/10 to-background border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">
                  Top Team
                </CardTitle>
                <Trophy className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {displayFaculty(facultyLeaderboard[0]?.name) || "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leading with {facultyLeaderboard[0]?.score || 0} points
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TeamRankingCard
              title="Team Rankings"
              description="Based on total points"
              entries={facultyLeaderboard}
              color="text-amber-500"
            />

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
                    <div className="text-center py-8 text-muted-foreground">
                      No students registered
                    </div>
                  ) : (
                    studentLeaderboard.map((student, index) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-6 w-6 items-center justify-center font-bold text-[10px]",
                              index <= 2 && "text-xl",
                              index > 2 && "text-muted-foreground",
                            )}
                          >
                            {formatLeaderboardRank(index)}
                          </div>
                          <div>
                            <p className="text-sm font-medium leading-none">
                              {student.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {displayFaculty(student.faculty)}
                            </p>
                          </div>
                        </div>
                        <div className="font-semibold text-sm">
                          {student.score}{" "}
                          <span className="text-xs font-normal text-muted-foreground ml-1">
                            points
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gender-specific Team Leaderboards */}
          <div className="grid gap-4 md:grid-cols-2">
            <TeamRankingCard
              title="Men's Team Rankings"
              description="Points from men's events"
              entries={facultyLeaderboardMale}
              color="text-blue-500"
            />
            <TeamRankingCard
              title="Women's Team Rankings"
              description="Points from women's events"
              entries={facultyLeaderboardFemale}
              color="text-pink-500"
            />
          </div>

          {/* Event Standings */}
          <Card className="h-full mt-4">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-blue-500" />
                    Event Standings
                  </CardTitle>
                  <CardDescription>View live results per event</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Gender Selector */}
                  <Tabs
                    value={selectedGender}
                    onValueChange={(val) => {
                      const nextGender = val as "Male" | "Female";
                      const oldPrefix = selectedGender === "Male" ? "M:" : "W:";
                      const newPrefix = nextGender === "Male" ? "M:" : "W:";

                      setSelectedGender(nextGender);

                      // Try to find the same event for the other gender instead of just clearing it
                      if (selectedEventStanding) {
                        const eventName = selectedEventStanding.replace(
                          oldPrefix,
                          "",
                        );
                        setSelectedEventStanding(`${newPrefix}${eventName}`);
                      }
                    }}
                  >
                    <TabsList className="h-9">
                      <TabsTrigger
                        value="Male"
                        className="px-4 text-xs font-semibold"
                      >
                        Men
                      </TabsTrigger>
                      <TabsTrigger
                        value="Female"
                        className="px-4 text-xs font-semibold"
                      >
                        Women
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="w-full">
                    <Select
                      value={selectedEventStanding}
                      onValueChange={setSelectedEventStanding}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select Event" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedMeet?.events
                          ?.filter((e) => e.startsWith(genderPrefix))
                          .map((e) => (
                            <SelectItem key={e} value={e}>
                              {e.replace(/^([MW]):/, "")}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventResults === undefined ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : eventResults.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-4 text-muted-foreground"
                        >
                          No results recorded yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      eventResults.map((result) => (
                        <TableRow key={result._id}>
                          <TableCell className="font-bold text-lg">
                            {result.rank === 1
                              ? "🥇"
                              : result.rank === 2
                                ? "🥈"
                                : result.rank === 3
                                  ? "🥉"
                                  : result.rank}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {result.student?.name || result.teamName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {result.student?.registrationNumber}
                            </div>
                          </TableCell>
                          <TableCell>
                            {displayFaculty(
                              result.teamName || result.student?.faculty,
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatTime(result.timing)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {result.points}
                          </TableCell>
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
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Select a meet to view stats
        </div>
      )}
    </div>
  );
}
