"use client";

import { downloadPdf } from "@/lib/pdf/download";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  useFieldArray,
  UseFormReturn,
  useWatch,
} from "react-hook-form";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckIcon, Trash2, Plus, Loader2, Download } from "lucide-react";
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
import { RegistrationTeamSelect } from "./registration-team-select";
import {
  teamLabel,
  normalizeTeam,
  type TeamInput,
} from "@/lib/meet-configuration";
import {
  Combobox,
  ComboboxInput,
  ComboboxPopup,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { MobileRegistrationForm } from "./MobileRegistrationForm";
import { useQuery, useMutation } from "convex/react";
import { registrationSnapshot } from "@/lib/registration-snapshot";
import { preferredMeetId } from "@/lib/meet-selection";
import { api } from "@/convex/_generated/api";

import { formSchema, type FormValues } from "@/lib/registration-form-schema";
import {
  isRegistrationLimitExceeded,
  eventCapacity,
} from "@/lib/registration-rules";

// Row Component for Spreadsheet-like behavior
const RegistrationRow = ({
  index,
  form,
  remove,
  columnCounts,
  availableEvents,
  teams,
}: {
  teams: TeamInput[];
  index: number;
  form: UseFormReturn<FormValues>;
  remove: (index: number) => void;
  columnCounts: Record<string, number>;
  availableEvents: string[] | readonly string[];
}) => {
  const events = useWatch({
    control: form.control,
    name: `registrations.${index}.events`,
    defaultValue: [],
  });

  const teamId = useWatch({
    control: form.control,
    name: `registrations.${index}.teamId`,
  });
  const isRowLimitExceeded = isRegistrationLimitExceeded(events);

  const toggleEvent = (event: string) => {
    const current = events || [];
    if (current.includes(event)) {
      form.setValue(
        `registrations.${index}.events`,
        current.filter((e: string) => e !== event),
      );
    } else {
      form.setValue(`registrations.${index}.events`, [...current, event]);
    }
  };

  return (
    <TableRow
      className={cn(
        "hover:bg-transparent break-inside-avoid",
        isRowLimitExceeded && "bg-destructive/10",
      )}
    >
      <TableCell className="p-0 border-r">
        <Input
          {...form.register(`registrations.${index}.student.name`)}
          className="h-10 border-0 bg-transparent shadow-none rounded-none px-4 focus-visible:ring-0 focus-visible:ring-inset focus-visible:ring-primary print:text-xs"
          placeholder="John Doe"
        />
        <div className="px-2 pb-2 print:hidden">
          <RegistrationTeamSelect
            teams={teams}
            value={teamId}
            onChange={(team) => {
              form.setValue(`registrations.${index}.teamId`, team.id);
              form.setValue(
                `registrations.${index}.student.faculty`,
                teamLabel(team),
              );
            }}
          />
        </div>
      </TableCell>
      <TableCell className="p-0 border-r print:hidden">
        <Input
          {...form.register(`registrations.${index}.student.nameInUse`)}
          className="h-10 border-0 bg-transparent shadow-none rounded-none px-4 focus-visible:ring-0 focus-visible:ring-inset focus-visible:ring-primary"
          placeholder="John"
        />
      </TableCell>
      <TableCell className="p-0 border-r">
        <Input
          {...form.register(
            `registrations.${index}.student.registrationNumber`,
          )}
          className="h-10 border-0 bg-transparent shadow-none rounded-none px-4 focus-visible:ring-0 focus-visible:ring-inset focus-visible:ring-primary print:text-xs"
          placeholder="2024s12323"
        />
      </TableCell>
      <TableCell className="p-0 border-r print:hidden">
        <Input
          {...form.register(`registrations.${index}.student.seed`, {
            setValueAs: (value) => (value === "" ? undefined : Number(value)),
          })}
          type="number"
          min={1}
          max={10}
          className="h-10 border-0 bg-transparent shadow-none rounded-none px-2 text-center focus-visible:ring-0 focus-visible:ring-inset focus-visible:ring-primary"
          placeholder="-"
        />
      </TableCell>
      {availableEvents.map((event) => {
        const limit = eventCapacity(event);
        const count = columnCounts[event] || 0;
        const isColumnLimitExceeded = count > limit;
        const isChecked = events && events.includes(event);

        return (
          <TableCell
            key={event}
            onClick={() => toggleEvent(event)}
            className={cn(
              "cursor-pointer border-r p-0 text-center hover:bg-muted/50 active:bg-muted transition-colors select-none print:w-8",
              isColumnLimitExceeded && isChecked && "bg-destructive/20",
            )}
          >
            <div className="flex h-10 items-center justify-center">
              {isChecked && (
                <CheckIcon
                  className={cn(
                    "h-5 w-5 stroke-green-600 print:h-4 print:w-4 print:stroke-black",
                    (isRowLimitExceeded || isColumnLimitExceeded) &&
                      "stroke-destructive",
                  )}
                />
              )}
            </div>
          </TableCell>
        );
      })}
      <TableCell className="print:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => remove(index)}
          className="h-8 w-6 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

export function RegistrationForm() {
  const [isMounted, setIsMounted] = useState(false);
  const [loadedMeetId, setLoadedMeetId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncState = useRef({
    meetId: "",
    baseline: "",
    dirty: false,
    resetting: false,
    saving: false,
    generation: 0,
  });
  const [activeTab, setActiveTab] = useState<"Male" | "Female">("Male");
  const [selectedFaculty, setSelectedFaculty] = useState<string>("");
  const [selectedMeetId, setSelectedMeetId] = useState<string>("");
  const [downloading, setDownloading] = useState(false);

  const meets = useQuery(api.meets.getMeets);

  // Derived state for current meet events (filtered by gender)
  const selectedMeet = meets?.find((m) => m._id === selectedMeetId);
  const meetTeams = (selectedMeet?.teams ?? [])
    .map(normalizeTeam)
    .filter((team) => team.code.length > 0);
  const selectedTeam =
    meetTeams.find((t) => teamLabel(t) === selectedFaculty) ?? meetTeams[0];
  const activeFaculty = selectedTeam ? teamLabel(selectedTeam) : "";
  const genderPrefix = activeTab === "Male" ? "M:" : "W:";

  const meetEvents = (selectedMeet?.events || []).filter(
    (e) => e.startsWith(genderPrefix) || !/^[MW]:/.test(e),
  );

  // Auto-select first active meet if none selected
  useEffect(() => {
    if (meets && meets.length > 0 && !selectedMeetId) {
      setSelectedMeetId(preferredMeetId(meets) ?? "");
    }
  }, [meets, selectedMeetId]);

  const remoteData = useQuery(
    api.registrations.get,
    selectedMeetId ? { meetId: selectedMeetId as Id<"meets"> } : "skip",
  );
  const syncData = useMutation(api.registrations.sync);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      registrations: [],
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "registrations",
    keyName: "formKey",
  });

  // Adopt live updates only when there are no unsaved local edits.
  useEffect(() => {
    setIsMounted(true);
    const state = syncState.current;
    if (state.meetId !== selectedMeetId) {
      state.meetId = selectedMeetId;
      state.baseline = "";
      state.dirty = false;
      state.generation++;
      setLoadedMeetId(null);
      setSyncError(null);
    }
    if (remoteData && !state.dirty && !state.saving) {
      state.resetting = true;
      form.reset({ registrations: remoteData });
      state.resetting = false;
      state.baseline = registrationSnapshot(remoteData);
      setLoadedMeetId(selectedMeetId);
    }
  }, [remoteData, form, selectedMeetId]);

  // Watch all registrations
  const registrations = useWatch({
    control: form.control,
    name: "registrations",
  });

  const handleAddNew = () => {
    if (loadedMeetId !== selectedMeetId) return;
    append({
      id: crypto.randomUUID(),
      teamId: selectedTeam?.id,
      student: {
        id: crypto.randomUUID(),
        name: "",
        registrationNumber: "",
        nameInUse: "",
        gender: activeTab,
        faculty: activeFaculty,
        seed: 1,
      },
      events: [],
      registeredAt: new Date(),
    });
  };

  // One timer and one write at a time; each snapshot is checked by the backend.
  useEffect(() => {
    if (loadedMeetId !== selectedMeetId || !selectedMeetId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const state = syncState.current;
    const generation = state.generation;
    const save = async () => {
      if (disposed || generation !== state.generation || !state.dirty) return;
      if (state.saving) {
        scheduleSave(100);
        return;
      }
      const rows = form.getValues("registrations");
      const sent = registrationSnapshot(rows);
      const payload = rows
        .filter(
          (reg) =>
            reg.student.name ||
            reg.student.registrationNumber ||
            reg.student.nameInUse ||
            reg.events.length > 0,
        )
        .map((r) => ({
          id: r.id,
          teamId: r.teamId as Id<"meetTeams"> | undefined,
          student: {
            id: r.student.id,
            name: r.student.name,
            registrationNumber: r.student.registrationNumber,
            nameInUse: r.student.nameInUse,
            gender: r.student.gender,
            faculty: r.student.faculty,
            seed:
              r.student.seed && r.student.seed > 0 ? r.student.seed : undefined,
          },
          events: r.events,
          registeredAt:
            r.registeredAt instanceof Date
              ? r.registeredAt.toISOString()
              : r.registeredAt,
        }));
      state.saving = true;
      try {
        const saved = await syncData({
          registrations: payload,
          meetId: selectedMeetId as Id<"meets">,
          expectedSnapshot: state.baseline,
        });
        if (disposed || generation !== state.generation) return;
        state.baseline = registrationSnapshot(saved);
        state.dirty =
          registrationSnapshot(form.getValues("registrations")) !== sent;
        setSyncError(null);
        if (!state.dirty) {
          // Keep empty local draft rows while receiving changes to saved rows.
          const empty = rows.filter(
            (reg) => !payload.some((item) => item.id === reg.id),
          );
          state.resetting = true;
          form.reset({ registrations: [...saved, ...empty] });
          state.resetting = false;
        } else scheduleSave(1000);
      } catch (error) {
        if (!disposed && generation === state.generation)
          setSyncError(
            error instanceof Error
              ? error.message
              : "Could not save registrations. Your edits were kept.",
          );
      } finally {
        state.saving = false;
      }
    };
    const scheduleSave = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void save();
      }, delay);
    };
    const subscription = form.watch(() => {
      if (state.resetting || disposed) return;
      state.dirty = true;
      scheduleSave(1000);
    });
    return () => {
      disposed = true;
      subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [form, syncData, loadedMeetId, selectedMeetId]);

  if (!isMounted) return null;

  // Calculate column counts per gender AND faculty
  const columnCounts = (registrations || []).reduce(
    (acc, curr) => {
      if (
        curr.student?.gender !== activeTab ||
        curr.student?.faculty !== activeFaculty
      )
        return acc;
      curr.events?.forEach((event) => {
        acc[event] = (acc[event] || 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>,
  );

  const handlePrint = async () => {
    if (!selectedMeetId || !selectedMeet) return;
    setDownloading(true);
    try {
      const genderPrefix = activeTab === "Male" ? "M:" : "W:";
      const currentMeetEvents = (selectedMeet.events || []).filter(
        (e: string) => e.startsWith(genderPrefix) || !/^[MW]:/.test(e),
      );
      const { generateRegistrationSheetPdf } =
        await import("@/lib/pdf/registration-sheet");
      const bytes = await generateRegistrationSheetPdf({
        meet: { name: selectedMeet.name, events: currentMeetEvents },
        registrations: registrations || [],
        filters: { gender: activeTab, faculty: activeFaculty },
      });
      const genderLabel = activeTab === "Male" ? "Men" : "Women";
      downloadPdf(
        bytes,
        `Registration Sheet ${selectedMeet.name} ${genderLabel} ${activeFaculty}.pdf`,
      );
    } catch (error) {
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

  return (
    <div className="space-y-4 border rounded-lg p-4 w-full">
      {syncError && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-destructive p-3 text-sm"
        >
          <p>{syncError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!remoteData || syncState.current.saving) return;
              // Explicit recovery discards the current draft only after user confirmation.
              if (
                !window.confirm(
                  "Discard your unsaved edits and load the latest registrations?",
                )
              )
                return;
              syncState.current.resetting = true;
              form.reset({ registrations: remoteData });
              syncState.current.resetting = false;
              syncState.current.dirty = false;
              syncState.current.baseline = registrationSnapshot(remoteData);
              setSyncError(null);
            }}
          >
            Load latest registrations
          </Button>
        </div>
      )}
      {/* Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between print:hidden gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          {/* Meet Selector */}
          <Select
            value={selectedMeetId}
            onValueChange={(val) => {
              if (syncState.current.dirty || syncState.current.saving) {
                setSyncError(
                  "Wait for your registrations to save before switching meets. If there is a conflict, reload the latest rows first.",
                );
                return;
              }
              setSelectedMeetId(val);
            }}
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

          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as "Male" | "Female")}
          >
            <TabsList className="h-9">
              <TabsTrigger value="Male" className="px-4">
                Men
              </TabsTrigger>
              <TabsTrigger value="Female" className="px-4">
                Women
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Combobox
            items={meetTeams.map(teamLabel)}
            value={activeFaculty || null}
            onValueChange={(value) => setSelectedFaculty(value ?? "")}
          >
            <ComboboxInput
              aria-label="Select meet team"
              placeholder="Select team"
            />
            <ComboboxPopup>
              <ComboboxEmpty>
                No teams configured. Add teams in Edit Meet.
              </ComboboxEmpty>
              <ComboboxList>
                {(name) => (
                  <ComboboxItem key={name} value={name}>
                    {name}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxPopup>
          </Combobox>
        </div>
        <Button
          onClick={handlePrint}
          disabled={downloading || !selectedMeet || !selectedTeam}
          variant="outline"
          size="sm"
        >
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {downloading ? "Generating PDF..." : "Download Sheet"}
        </Button>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="*:border-border hover:bg-transparent [&>:not(:last-child)]:border-r">
              <TableHead className="border-r w-80 print:text-black">
                Student Name
              </TableHead>
              <TableHead className="border-r w-36 print:hidden">
                Name in Use
              </TableHead>
              <TableHead className="border-r w-52 print:text-black">
                Reg. No
              </TableHead>
              <TableHead className="border-r w-16 print:text-black">
                Seed
              </TableHead>
              {meetEvents.map((event) => {
                const limit = eventCapacity(event);
                const count = columnCounts[event] || 0;
                const isColumnFull = count > limit;
                return (
                  <TableHead
                    className={cn(
                      "h-auto border-r px-2 py-3 text-center align-bottom print:text-black print:p-1",
                      isColumnFull &&
                        "bg-destructive/10 text-destructive font-bold",
                    )}
                    key={event}
                  >
                    <span className="block w-6 whitespace-nowrap [writing-mode:vertical-rl] rotate-180 mx-auto print:text-xs">
                      {event.replace(/^([MW]):/, "")}
                    </span>
                  </TableHead>
                );
              })}
              <TableHead className="print:hidden">
                <span className="block w-6 whitespace-nowrap [writing-mode:vertical-rl] rotate-180 mx-auto print:text-xs"></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Show message if no meet selected */}
            {!selectedMeetId && (
              <TableRow>
                <TableCell
                  colSpan={meetEvents.length + 5}
                  className="h-24 text-center"
                >
                  Please select a meet to start registering.
                </TableCell>
              </TableRow>
            )}

            {selectedMeetId &&
              loadedMeetId === selectedMeetId &&
              fields.map((field, index) => {
                // Retrieve gender from current form data if available, else fallback to field
                const gender = registrations?.[index]?.student?.gender;
                const faculty = registrations?.[index]?.student?.faculty;

                if (gender !== activeTab || faculty !== activeFaculty)
                  return null;

                return (
                  <RegistrationRow
                    key={field.formKey}
                    index={index}
                    form={form}
                    remove={remove}
                    columnCounts={columnCounts}
                    teams={meetTeams}
                    availableEvents={meetEvents}
                  />
                );
              })}

            {/* Add New Row - Only if meet selected */}
            {selectedMeetId && selectedTeam && (
              <TableRow
                className="*:border-border hover:bg-muted/50 cursor-pointer [&>:not(:last-child)]:border-r print:hidden"
                onClick={handleAddNew}
              >
                <TableHead className="border-r print:text-black">
                  <div className="flex items-center text-muted-foreground hover:text-foreground">
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Student
                  </div>
                </TableHead>
                <TableHead className="border-r print:hidden" />
                <TableHead className="border-r print:text-black" />
                <TableHead className="border-r print:hidden" />
                {meetEvents.map((event) => {
                  return (
                    <TableHead
                      className="h-auto border-r px-2 py-3 text-center align-bottom print:text-black print:p-1"
                      key={event}
                    />
                  );
                })}
                <TableHead className="print:hidden" />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {!selectedMeetId || loadedMeetId !== selectedMeetId ? (
          <div className="p-8 text-center text-muted-foreground border rounded-lg">
            Please select a meet above.
          </div>
        ) : (
          <>
            <MobileRegistrationForm
              form={form}
              teams={meetTeams}
              fields={fields}
              remove={remove}
              activeTab={activeTab}
              columnCounts={columnCounts}
              selectedFaculty={activeFaculty}
              availableEvents={meetEvents}
            />
            <Button
              disabled={!selectedTeam || loadedMeetId !== selectedMeetId}
              onClick={handleAddNew}
              className="w-full"
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
