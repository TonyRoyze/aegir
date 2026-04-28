"use client";

import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { use } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Loader2, Trophy, Waves, Settings, ListOrdered } from "lucide-react";
// import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
  }
  return `${seconds}.${centiseconds.toString().padStart(2, "0")}`;
}

type ViewType = "faculty" | "event" | "heats";

export default function PublicMeetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const meet = useQuery(api.meets.getMeetByPublicToken, { token });

  if (meet === undefined) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!meet) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-destructive">Invalid link</div>
      </div>
    );
  }

  return <PublicMeetContent meetId={meet._id} events={meet.events} />;
}

function PublicMeetContent({
  meetId,
  events,
}: {
  meetId: string;
  events: string[];
}) {
  const [selectedView, setSelectedView] = useState<ViewType>("faculty");
  const [selectedGender, setSelectedGender] = useState<"Male" | "Female">(
    "Male",
  );
  const [selectedEventStanding, setSelectedEventStanding] =
    useState<string>("");
  const [selectedHeatEvent, setSelectedHeatEvent] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const leaderboard = useQuery(api.dashboard.getPublicLeaderboard, {
    meetId: meetId as any,
  });

  const genderPrefix = selectedGender === "Male" ? "M:" : "W:";
  const filteredEvents = events.filter((e) => e.startsWith(genderPrefix));

  const totalPoints =
    leaderboard?.facultyLeaderboard.reduce((sum, f) => sum + f.score, 0) || 0;

  const eventResults = useQuery(
    api.results.getResults,
    selectedEventStanding
      ? { meetId: meetId as any, event: selectedEventStanding }
      : "skip",
  );

  const heatAssignments = useQuery(
    api.meets.getHeatAssignments,
    selectedHeatEvent && selectedGender ? { meetId: meetId as any } : "skip",
  );

  if (leaderboard === undefined) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const heatsByEvent =
    heatAssignments
      ?.filter(
        (h) => h.event === selectedHeatEvent && h.gender === selectedGender,
      )
      .reduce(
        (acc, h) => {
          if (!acc[h.heat]) acc[h.heat] = [];
          acc[h.heat].push(h);
          return acc;
        },
        {} as Record<number, typeof heatAssignments>,
      ) || {};

  const heatNumbers = Object.keys(heatsByEvent)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight">
          {leaderboard.meetName}
        </h1>
        <p className="text-muted-foreground">{leaderboard.meetDate}</p>
      </div>

      {selectedView === "faculty" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Faculty Rankings
            </CardTitle>
            <CardDescription>Based on total points</CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboard.facultyLeaderboard.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No data yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Faculty</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="w-32">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.facultyLeaderboard.map((faculty, index) => (
                    <TableRow key={faculty.name}>
                      <TableCell className="font-bold text-lg">
                        {index === 0
                          ? "🥇"
                          : index === 1
                            ? "🥈"
                            : index === 2
                              ? "🥉"
                              : index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {faculty.name}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {faculty.score}
                      </TableCell>
                      <TableCell>
                        <Progress
                          value={(faculty.score / (totalPoints || 1)) * 100}
                          className="h-2"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : selectedView === "event" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waves className="h-5 w-5 text-blue-500" />
              {selectedEventStanding
                ? selectedEventStanding.replace(/^([MW]):/, "")
                : "Event Standings"}
            </CardTitle>
            <CardDescription>
              {selectedEventStanding
                ? `${leaderboard.meetName}`
                : "Tap settings to select an event"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedEventStanding && eventResults ? (
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
                  {eventResults.length === 0 ? (
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
                            {result.student?.nameInUse}
                          </div>
                          <div className="hidden text-xs text-muted-foreground md:block">
                            {result.student?.registrationNumber}
                          </div>
                        </TableCell>
                        <TableCell>{result.student?.faculty}</TableCell>
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
                Tap the settings button to select an event
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-green-500" />
              {selectedHeatEvent
                ? selectedHeatEvent.replace(/^([MW]):/, "")
                : "Heat Lanes"}
            </CardTitle>
            <CardDescription>
              {selectedHeatEvent
                ? `${selectedGender === "Male" ? "Men" : "Women"} - Heat ${heatNumbers.join(", ")}`
                : "Tap settings to select an event"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedHeatEvent && heatNumbers.length > 0 ? (
              <div className="space-y-6">
                {heatNumbers.map((heatNum) => (
                  <div key={heatNum}>
                    <h3 className="font-bold mb-2">Heat {heatNum}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Lane</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Faculty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {heatsByEvent[heatNum]
                          .sort((a, b) => a.lane - b.lane)
                          .map((assignment) => (
                            <TableRow key={assignment._id}>
                              <TableCell className="font-bold">
                                {assignment.lane}
                              </TableCell>
                              <TableCell>
                                <div className="hidden font-medium md:block">
                                  {assignment.student?.name}
                                </div>
                                <div className="font-medium md:hidden">
                                  {assignment.student?.nameInUse}
                                </div>
                                <div className="hidden font-medium md:blocktext-xs text-muted-foreground">
                                  {assignment.student?.registrationNumber}
                                </div>
                              </TableCell>
                              <TableCell>
                                {assignment.student?.faculty}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                Tap the settings button to select an event
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <Button
            size="icon"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
          >
            <Settings className="h-6 w-6" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Filter Settings</DrawerTitle>
            <DrawerDescription>Select view, gender and event</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 p-4 pt-0">
            <div>
              <label className="text-sm font-medium mb-2 block">View</label>
              <Tabs
                value={selectedView}
                onValueChange={(v) => setSelectedView(v as ViewType)}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="faculty" className="flex-1">
                    <Trophy className="h-4 w-4 mr-2" />
                    Faculty
                  </TabsTrigger>
                  <TabsTrigger value="event" className="flex-1">
                    <Waves className="h-4 w-4 mr-2" />
                    Event
                  </TabsTrigger>
                  <TabsTrigger value="heats" className="flex-1">
                    <ListOrdered className="h-4 w-4 mr-2" />
                    Heats
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {(selectedView === "event" || selectedView === "heats") && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Gender
                  </label>
                  <Tabs
                    value={selectedGender}
                    onValueChange={(val) => {
                      const nextGender = val as "Male" | "Female";
                      const oldPrefix = selectedGender === "Male" ? "M:" : "W:";
                      const newPrefix = nextGender === "Male" ? "M:" : "W:";
                      setSelectedGender(nextGender);
                      if (selectedEventStanding) {
                        const eventName = selectedEventStanding.replace(
                          oldPrefix,
                          "",
                        );
                        setSelectedEventStanding(`${newPrefix}${eventName}`);
                      }
                      if (selectedHeatEvent) {
                        const eventName = selectedHeatEvent.replace(
                          oldPrefix,
                          "",
                        );
                        setSelectedHeatEvent(`${newPrefix}${eventName}`);
                      }
                    }}
                  >
                    <TabsList className="w-full">
                      <TabsTrigger value="Male" className="flex-1">
                        Men
                      </TabsTrigger>
                      <TabsTrigger value="Female" className="flex-1">
                        Women
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Event
                  </label>
                  <Select
                    value={
                      selectedView === "event"
                        ? selectedEventStanding
                        : selectedHeatEvent
                    }
                    onValueChange={(val) => {
                      if (selectedView === "event") {
                        setSelectedEventStanding(val);
                      } else {
                        setSelectedHeatEvent(val);
                      }
                      setDrawerOpen(false);
                    }}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select Event" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredEvents.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e.replace(/^([MW]):/, "")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
