"use client";

import { type ReactNode, use, useMemo, useState, useEffect } from "react";
import Image from "next/image";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { assignToHeats, LANES_PER_HEAT } from "@/lib/swimming-utils";

function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
  }
  return `${seconds}.${centiseconds.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type ViewType = "faculty" | "event" | "heats";

type HeatParticipant = {
  id?: string;
  name?: string;
  nameInUse?: string;
  gender?: "Male" | "Female";
  faculty?: string;
  seed?: number;
  isRelay?: boolean;
};

const POOL_PHOTO_URL = "/background.png";
const DRAWER_ICON_PATHS = {
  faculty: "/trophy.png",
  heats: "/lanes.png",
  event: "/timing.png",
  settings: "/settings.png",
  instagram: "/instagram.png",
  swimmer: "/swimmer.png",
} as const;

function PngIcon({
  src,
  alt,
  className = "size-5",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={28}
      height={28}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

function MedalBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  if (medal) {
    return (
      <div
        className={cn(
          "flex size-8.5 items-center justify-center rounded-full text-[22px]",
          rank === 1 && "bg-[#ffd700]/20",
          rank === 2 && "bg-[#c0c0c0]/20",
          rank === 3 && "bg-[#cd7f32]/20",
        )}
      >
        {medal}
      </div>
    );
  }

  return (
    <div className="flex size-8.5 items-center justify-center text-[15px] font-bold text-[#6b7a8d]">
      {rank}
    </div>
  );
}

function PoolRow({
  rank,
  primary,
  secondary,
  trailing,
}: {
  rank: number;
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center border-b border-black/6 px-1 py-2.5 last:border-b-0">
      <MedalBadge rank={rank} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <div className="min-w-0 truncate text-[15px] font-semibold leading-5 text-[#1a2535]">
            {primary}
          </div>
          {trailing ? (
            <div className="shrink-0 text-right font-mono text-[13px] font-semibold text-[#25435a]">
              {trailing}
            </div>
          ) : null}
        </div>
        {secondary ? (
          <div className="mt-0.5 truncate text-[11px] font-medium text-black/50">
            {secondary}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PoolColumnHeads({
  secondLabel,
  trailingLabel,
}: {
  secondLabel: string;
  trailingLabel?: string;
}) {
  return (
    <div className="mb-1 grid grid-cols-[52px_minmax(0,1fr)] border-b border-black/6 px-1 pb-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9aabb8]">
        Rank
      </span>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9aabb8]">
          {secondLabel}
        </span>
        {trailingLabel ? (
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9aabb8]">
            {trailingLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function EmptyPoolState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[#b8c6d3] bg-white/45 px-4 py-7 text-center text-[13px] font-medium text-[#718397]">
      {children}
    </div>
  );
}

function PoolHeatTable({
  heatNumber,
  heat,
  isRelayEvent,
}: {
  heatNumber: number;
  heat: (HeatParticipant | null)[];
  isRelayEvent: boolean;
}) {
  const lanes = Array.from({ length: LANES_PER_HEAT }, (_, index) => index + 1);

  return (
    <div>
      <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-[#6f8193]">
        Heat {String(heatNumber).padStart(2, "0")}
      </h3>
      <div>
        <div
          className={cn(
            "mb-1 grid border-b border-black/6 px-1 pb-1.5",
            isRelayEvent
              ? "grid-cols-[52px_minmax(0,1fr)]"
              : "grid-cols-[52px_minmax(0,1fr)_64px]",
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9aabb8]">
            Lane
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9aabb8]">
            {isRelayEvent ? "Faculty" : "Student"}
          </span>
          {!isRelayEvent ? (
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9aabb8]">
              Faculty
            </span>
          ) : null}
        </div>
        {lanes.map((lane) => {
          const participant = heat[lane - 1];

          return (
            <div
              key={lane}
              className={cn(
                "grid items-center border-b border-black/6 px-1 py-2.5 last:border-b-0",
                isRelayEvent
                  ? "grid-cols-[52px_minmax(0,1fr)]"
                  : "grid-cols-[52px_minmax(0,1fr)_64px]",
              )}
            >
              <span className="flex size-8.5 items-center justify-center text-[15px] font-bold text-[#6b7a8d]">
                {lane}
              </span>
              <span className="min-w-0 truncate text-[15px] font-semibold leading-5 text-[#1a2535]">
                {participant?.nameInUse || participant?.name || "Empty"}
              </span>
              {!isRelayEvent ? (
                <span className="truncate text-right text-[12px] font-semibold text-[#6f8193]">
                  {participant?.faculty || ""}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PublicMeetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const meet = useQuery(api.meets.getMeetByPublicToken, { token });

  useEffect(() => {
    // Lock scrolling
    document.body.style.overflow = "hidden";

    // Cleanup: Unlock scrolling when leaving the page
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

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
  meetId: Id<"meets">;
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
    meetId,
  });

  const genderPrefix = selectedGender === "Male" ? "M:" : "W:";
  const filteredEvents = events.filter((e) => e.startsWith(genderPrefix));

  const eventResults = useQuery(
    api.results.getResults,
    selectedEventStanding ? { meetId, event: selectedEventStanding } : "skip",
  );

  const registrations = useQuery(
    api.registrations.get,
    selectedView === "heats" ? { meetId } : "skip",
  );

  const selectedHeatEventName = selectedHeatEvent.replace(/^([MW]):/, "");
  const isSelectedRelayEvent = selectedHeatEvent
    .toLowerCase()
    .includes("relay");

  const heatRows = useMemo(() => {
    if (!registrations || !selectedHeatEvent) return [];

    const eventRegistrations = registrations.filter((registration) =>
      registration.events.some(
        (eventName) =>
          eventName === selectedHeatEvent ||
          eventName === selectedHeatEventName,
      ),
    );

    let participants: HeatParticipant[] = eventRegistrations.map(
      (registration) => registration.student,
    );

    if (isSelectedRelayEvent) {
      const facultyTeams = new Map<string, HeatParticipant>();
      participants.forEach((student) => {
        const faculty = student.faculty || "Unknown";
        if (!facultyTeams.has(faculty)) {
          facultyTeams.set(faculty, {
            id: faculty,
            name: faculty,
            nameInUse: faculty,
            faculty,
            gender: student.gender,
            seed: student.seed,
            isRelay: true,
          });
        }
      });
      participants = Array.from(facultyTeams.values());
    }

    const genderParticipants = participants.filter(
      (participant) =>
        !participant.gender || participant.gender === selectedGender,
    );

    if (genderParticipants.length === 0) return [];

    return assignToHeats(
      genderParticipants,
      LANES_PER_HEAT,
    ) as (HeatParticipant | null)[][];
  }, [
    isSelectedRelayEvent,
    registrations,
    selectedGender,
    selectedHeatEvent,
    selectedHeatEventName,
  ]);

  if (leaderboard === undefined) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const viewIcon =
    selectedView === "faculty" ? (
      <PngIcon
        src={DRAWER_ICON_PATHS.faculty}
        alt=""
        className="mr-2 size-12"
      />
    ) : selectedView === "event" ? (
      <PngIcon src={DRAWER_ICON_PATHS.event} alt="" className="mr-2 size-12" />
    ) : (
      <PngIcon src={DRAWER_ICON_PATHS.heats} alt="" className="mr-2 size-12" />
    );

  const viewTitle =
    selectedView === "faculty"
      ? "Faculty Rankings"
      : selectedView === "event" && selectedEventStanding
        ? selectedEventStanding.replace(/^([MW]):/, "")
        : selectedView === "event"
          ? "Event Standings"
          : selectedHeatEvent
            ? selectedHeatEvent.replace(/^([MW]):/, "")
            : "Heat Lanes";

  const viewSub =
    selectedView === "faculty"
      ? "Based on total points"
      : selectedView === "event" && selectedEventStanding
        ? `${selectedGender === "Male" ? "Men" : "Women"} results`
        : selectedView === "heats" && selectedHeatEvent && heatRows.length
          ? `${selectedGender === "Male" ? "Men" : "Women"} - ${heatRows.length} heat${heatRows.length === 1 ? "" : "s"}`
          : selectedView === "heats" && selectedHeatEvent
            ? `${selectedGender === "Male" ? "Men" : "Women"} heats`
            : "Tap settings to select an event";

  return (
    <div className="mx-auto flex h-[calc(100dvh-2rem)] w-full max-w-7xl flex-col gap-4">
      <style>{`
        @keyframes publicMeetBob {
          0% { transform: translateY(0px) rotate(-0.3deg); }
          35% { transform: translateY(-6px) rotate(0.2deg); }
          65% { transform: translateY(-2px) rotate(-0.1deg); }
          100% { transform: translateY(0px) rotate(-0.3deg); }
        }

        @keyframes publicMeetShadow {
          0% { transform: scaleX(1); opacity: 0.55; }
          35% { transform: scaleX(1.1); opacity: 0.3; }
          100% { transform: scaleX(1); opacity: 0.55; }
        }

        @media (prefers-reduced-motion: reduce) {
          .public-meet-float,
          .public-meet-shadow {
            animation: none !important;
          }
        }
      `}</style>

      <div
        id="pool"
        className="mx-auto flex w-full flex-1 rounded-[30px] p-3 sm:p-4 max-h-full"
        style={{
          backgroundColor: "#F3F5F6",
          backgroundImage:
            "radial-gradient(circle at 10% 20%, rgba(25,103,126,0.3) 0 1.5px, transparent 1.8px), radial-gradient(circle at 80% 35%, rgba(255,255,255,0.8) 0 1.2px, transparent 1.5px), radial-gradient(circle at 45% 75%, rgba(63,145,162,0.28) 0 1.4px, transparent 1.8px)",
          backgroundSize: "18px 18px, 24px 24px, 28px 28px",
        }}
      >
        <section
          className="relative h-full w-full overflow-hidden rounded-[20px] bg-[#F3F5F6] bg-cover bg-center bg-no-repeat px-5 py-10 font-sans sm:px-6"
          style={{ backgroundImage: `url(${POOL_PHOTO_URL})` }}
        >
          <div className="absolute inset-0 bg-sky-950/5" aria-hidden="true" />
          <div className="relative z-10 flex h-full w-full flex-col justify-start items-center gap-4">
            <header
              className="public-meet-float grid w-full max-w-3xl grid-cols-[52px_minmax(0,1fr)_52px] items-center gap-3 rounded-[18px] border border-white/95 bg-white/88 px-4 py-3 shadow-[0_18px_45px_rgba(9,44,78,0.18)] backdrop-blur-[2px] sm:grid-cols-[72px_minmax(0,1fr)_72px] sm:px-5"
              style={{ animation: "publicMeetBob 4s ease-in-out infinite" }}
            >
              <Image
                src="/university-logo.svg"
                alt="University Logo"
                width={72}
                height={72}
                className="h-13 w-13 object-contain sm:h18 sm:w18"
                priority
              />
              <div className="min-w-0 text-center">
                <h1 className="truncate text-2xl font-black tracking-tight text-[#1a1a2e] sm:text-4xl">
                  {leaderboard.meetName}
                </h1>
                <p className="mt-1 text-sm font-medium text-black/50 sm:text-base">
                  {formatDate(leaderboard.meetDate)}
                </p>
              </div>
              <Image
                src="/swimming-logo.svg"
                alt="Swimming Logo"
                width={72}
                height={72}
                className="h-13 w-13 object-contain sm:h18 sm:w18"
                priority
              />
            </header>
            <div
              id="stats-table"
              className="public-meet-float min-h-0 flex-1 w-full max-w-3xl overflow-y-auto overscroll-contain rounded-[18px] border border-white/95 bg-white/88 px-4.5 pt-5 shadow-[0_22px_55px_rgba(9,44,78,0.22)] backdrop-blur-[2px] mb-4 max-h-[calc(100dvh-14rem)]"
              style={{ animation: "publicMeetBob 4s ease-in-out infinite" }}
            >
              <div className="mb-4 flex items-center gap-1.75">
                {viewIcon}
                <div>
                  <h2 className="truncate text-[13px] font-semibold leading-5 text-black">
                    {viewTitle}
                  </h2>
                  <p className="text-[11px] leading-4 text-black/50">
                    {viewSub}
                  </p>
                </div>
              </div>

              {selectedView === "faculty" ? (
                leaderboard.facultyLeaderboard.length === 0 ? (
                  <EmptyPoolState>No data yet</EmptyPoolState>
                ) : (
                  <>
                    <PoolColumnHeads secondLabel="Faculty" />
                    {leaderboard.facultyLeaderboard.map((faculty, index) => (
                      <PoolRow
                        key={faculty.name}
                        rank={index + 1}
                        primary={faculty.name}
                      />
                    ))}
                  </>
                )
              ) : selectedView === "event" ? (
                selectedEventStanding && eventResults ? (
                  eventResults.length === 0 ? (
                    <EmptyPoolState>No results recorded yet</EmptyPoolState>
                  ) : (
                    <>
                      <PoolColumnHeads
                        secondLabel="Student"
                        trailingLabel="Time"
                      />
                      {eventResults.map((result) => (
                        <PoolRow
                          key={result._id}
                          rank={result.rank ?? 0}
                          primary={result.student?.nameInUse || "Unassigned"}
                          secondary={result.student?.faculty}
                          trailing={formatTime(result.timing)}
                        />
                      ))}
                    </>
                  )
                ) : (
                  <EmptyPoolState>
                    Tap the settings button to select an event
                  </EmptyPoolState>
                )
              ) : selectedHeatEvent && registrations === undefined ? (
                <div className="flex justify-center py-7">
                  <Loader2 className="size-5 animate-spin text-[#6f8193]" />
                </div>
              ) : selectedHeatEvent && heatRows.length > 0 ? (
                <div className="space-y-4">
                  {heatRows.map((heat, heatIndex) => (
                    <PoolHeatTable
                      key={heatIndex}
                      heatNumber={heatIndex + 1}
                      heat={heat}
                      isRelayEvent={isSelectedRelayEvent}
                    />
                  ))}
                </div>
              ) : selectedHeatEvent ? (
                <EmptyPoolState>
                  No participants registered for this event yet
                </EmptyPoolState>
              ) : (
                <EmptyPoolState>
                  Tap the settings button to select an event
                </EmptyPoolState>
              )}
            </div>
            <div
              className="public-meet-shadow absolute -bottom-3 left-[10%] right-[10%] h-4 rounded-full bg-[#003c78]/20 blur-lg"
              style={{ animation: "publicMeetShadow 4s ease-in-out infinite" }}
              aria-hidden="true"
            />
          </div>
        </section>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <Button
            size="icon"
            className="fixed bottom-6 right-6 z-20 h-20 w-20 rounded-full bg-transparent"
            aria-label="Open filter settings"
          >
            <PngIcon
              src={DRAWER_ICON_PATHS.settings}
              alt=""
              className="size-20 rounded-full"
            />
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
                    <PngIcon
                      src={DRAWER_ICON_PATHS.faculty}
                      alt=""
                      className="mr-2 size-5 rounded-sm"
                    />
                    Faculty
                  </TabsTrigger>
                  <TabsTrigger value="event" className="flex-1">
                    <PngIcon
                      src={DRAWER_ICON_PATHS.swimmer}
                      alt=""
                      className="mr-2 size-5 rounded-sm"
                    />
                    Event
                  </TabsTrigger>
                  <TabsTrigger value="heats" className="flex-1">
                    <PngIcon
                      src={DRAWER_ICON_PATHS.heats}
                      alt=""
                      className="mr-2 size-5 rounded-sm"
                    />
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

          <div className="border-t p-4 mt-auto">
            <p className="text-center text-xs text-muted-foreground mb-3">
              Follow us on
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="ghost" size="icon" asChild className="h-12 w-12">
                <a
                  href="https://www.instagram.com/uoc_swimming?igsh=MTQxa2ExM2l3OWVuOA=="
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                >
                  <PngIcon
                    src={DRAWER_ICON_PATHS.instagram}
                    alt=""
                    className="size-20 rounded-md"
                  />
                </a>
              </Button>
              {/*<Button
                variant="outline"
                size="icon"
                asChild
                className="h-12 w-12"
              >
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <Facebook className="h-5 w-5" />
                </a>
              </Button>
              <Button
                variant="outline"
                size="icon"
                asChild
                className="h-12 w-12"
              >
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                  <Youtube className="h-5 w-5" />
                </a>
              </Button>*/}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
