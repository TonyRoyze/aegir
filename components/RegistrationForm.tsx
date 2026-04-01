"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFieldArray, UseFormReturn, useWatch } from "react-hook-form"
import { Id } from "@/convex/_generated/dataModel"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckIcon, Trash2, Plus, Loader2, Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SWIM_EVENTS, FACULTIES } from "@/types"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { MobileRegistrationView } from "./MobileRegistrationView"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"

// Schema
const registrationSchema = z.object({
  id: z.string(),
  student: z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required"),
    registrationNumber: z.string(),
    nameInUse: z.string(),
    age: z.number().optional(),
    gender: z.enum(["Male", "Female"]).optional(),
    faculty: z.string().optional(),
  }),
  events: z.array(z.string()),
  registeredAt: z.union([z.string(), z.date()]),
})

const formSchema = z.object({
  registrations: z.array(registrationSchema),
})

type FormValues = z.infer<typeof formSchema>

// Row Component for Spreadsheet-like behavior
const RegistrationRow = ({
  index,
  form,
  remove,
  columnCounts,
  availableEvents
}: {
  index: number
  form: UseFormReturn<FormValues>
  remove: (index: number) => void
  columnCounts: Record<string, number>
  availableEvents: string[] | readonly string[]
}) => {
  const events = useWatch({
    control: form.control,
    name: `registrations.${index}.events`,
    defaultValue: [],
  })

  // Rule 1: Max 3 checks excluding the last column
  // Identify the last event from availableEvents
  const lastEvent = availableEvents[availableEvents.length - 1];
  const eventsToCheckLimit = events ? events.filter(e => e !== lastEvent) : [];
  const isRowLimitExceeded = eventsToCheckLimit.length > 3;

  const toggleEvent = (event: string) => {
    const current = events || []
    if (current.includes(event)) {
      form.setValue(`registrations.${index}.events`, current.filter((e: string) => e !== event))
    } else {
      form.setValue(`registrations.${index}.events`, [...current, event])
    }
  }

  return (
    <TableRow className={cn("hover:bg-transparent break-inside-avoid", isRowLimitExceeded && "bg-destructive/10")}>
      <TableCell className="p-0 border-r">
        <Input
          {...form.register(`registrations.${index}.student.name`)}
          className="h-10 border-0 bg-transparent shadow-none rounded-none px-4 focus-visible:ring-0 focus-visible:ring-inset focus-visible:ring-primary print:text-xs"
          placeholder="John Doe"
        />
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
          {...form.register(`registrations.${index}.student.registrationNumber`)}
          className="h-10 border-0 bg-transparent shadow-none rounded-none px-4 focus-visible:ring-0 focus-visible:ring-inset focus-visible:ring-primary print:text-xs"
          placeholder="2024s12323"
        />
      </TableCell>
      {availableEvents.map((event) => {
        const isColumnLimitExceeded = (columnCounts[event] || 0) > 2;
        const isChecked = events && events.includes(event);

        return (
          <TableCell
            key={event}
            onClick={() => toggleEvent(event)}
            className={cn(
              "cursor-pointer border-r p-0 text-center hover:bg-muted/50 active:bg-muted transition-colors select-none print:w-8",
              isColumnLimitExceeded && isChecked && "bg-destructive/20"
            )}
          >
            <div className="flex h-10 items-center justify-center">
              {isChecked && (
                <CheckIcon className={cn("h-5 w-5 stroke-green-600 print:h-4 print:w-4 print:stroke-black", (isRowLimitExceeded || isColumnLimitExceeded) && "stroke-destructive")} />
              )}
            </div>
          </TableCell>
        )
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
  )
}


export function RegistrationForm() {
  const [isMounted, setIsMounted] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<"Male" | "Female">("Male")
  const [selectedFaculty, setSelectedFaculty] = useState<string>(FACULTIES[0])
  const [selectedMeetId, setSelectedMeetId] = useState<string>("")
  const [downloading, setDownloading] = useState(false)

  const meets = useQuery(api.meets.getMeets)

  // Derived state for current meet events
  const selectedMeet = meets?.find(m => m._id === selectedMeetId)
  const meetEvents = selectedMeet?.events || SWIM_EVENTS

  // Auto-select first active meet if none selected
  useEffect(() => {
    if (meets && meets.length > 0 && !selectedMeetId) {
      // Prefer active meets
      const active = meets.find(m => m.status === "active")
      setSelectedMeetId(active?._id || meets[0]._id)
    }
  }, [meets, selectedMeetId])

  const remoteData = useQuery(api.registrations.get, selectedMeetId ? { meetId: selectedMeetId as Id<"meets"> } : "skip")
  const syncData = useMutation(api.registrations.sync)


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      registrations: [],
    },
    mode: "onChange",
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "registrations",
  })

  // Load data on mount/when available
  useEffect(() => {
    setIsMounted(true)
    if (remoteData && !hasLoaded) {
      // Create a clean copy of the data compatible with the form
      form.reset({ registrations: remoteData })
      setHasLoaded(true)
    }
  }, [remoteData, form, hasLoaded])

  // Watch all registrations
  const registrations = useWatch({
    control: form.control,
    name: "registrations",
  })

  const handleAddNew = () => {
    append({
      id: crypto.randomUUID(),
      student: {
        id: crypto.randomUUID(),
        name: "",
        registrationNumber: "",
        nameInUse: "",
        gender: activeTab,
        faculty: selectedFaculty,
      },
      events: [],
      registeredAt: new Date(),
    })
  }

  // Save to Convex (debounced)
  useEffect(() => {
    if (!hasLoaded || !selectedMeetId) return

    const subscription = form.watch((value) => {
      if (value.registrations) {
        // Filter out empty rows
        const validRegistrations = value.registrations.filter((reg: any) =>
          reg.student?.name ||
          reg.student?.registrationNumber ||
          reg.student?.nameInUse ||
          (reg.events && reg.events.length > 0)
        )

        const handler = setTimeout(() => {
          const payload = validRegistrations.map((r: any) => ({
            id: r.id,
            student: {
              id: r.student.id,
              name: r.student.name,
              registrationNumber: r.student.registrationNumber,
              nameInUse: r.student.nameInUse,
              age: r.student.age,
              gender: r.student.gender,
              faculty: r.student.faculty,
            },
            events: r.events,
            registeredAt: r.registeredAt instanceof Date ? r.registeredAt.toISOString() : r.registeredAt
          }))
          syncData({ registrations: payload, meetId: selectedMeetId as Id<"meets"> })
        }, 1000)

        return () => clearTimeout(handler)
      }
    })
    return () => subscription.unsubscribe()
  }, [form.watch, syncData, hasLoaded, selectedMeetId])

  if (!isMounted) return null

  // Calculate column counts per gender AND faculty
  const columnCounts = (registrations || []).reduce((acc, curr) => {
    if (curr.student?.gender !== activeTab || curr.student?.faculty !== selectedFaculty) return acc
    curr.events?.forEach((event) => {
      acc[event] = (acc[event] || 0) + 1
    })
    return acc
  }, {} as Record<string, number>)



  const handlePrint = async () => {
    if (!selectedMeetId) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        gender: activeTab,
        faculty: selectedFaculty
      });
      const response = await fetch(`/api/print/registration-sheet/${selectedMeetId}?${params}`);
      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const genderLabel = activeTab === "Male" ? "Men" : "Women";
      link.download = `Registration Sheet ${selectedMeet?.name || 'document'} ${genderLabel} ${selectedFaculty}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4 p-6 md:p-8">
      {/* Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between print:hidden gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          {/* Meet Selector */}
          <Select value={selectedMeetId} onValueChange={(val) => {
            setSelectedMeetId(val)
            setHasLoaded(false) // Trigger reload for new meet
          }}>
            <SelectTrigger className="w-full md:w-[250px]">
              <SelectValue placeholder="Select Meet" />
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

          <div className="flex space-x-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setActiveTab("Male")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                activeTab === "Male" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:bg-background/50"
              )}
            >
              Men
            </button>
            <button
              onClick={() => setActiveTab("Female")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                activeTab === "Female" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:bg-background/50"
              )}
            >
              Women
            </button>
          </div>
          <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Select faculty" />
            </SelectTrigger>
            <SelectContent>
              {FACULTIES.map((faculty) => (
                <SelectItem key={faculty} value={faculty}>
                  {faculty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handlePrint} disabled={downloading} variant="outline" size="sm">
          {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {downloading ? "Generating PDF..." : "Download Sheet"}
        </Button>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="*:border-border hover:bg-transparent [&>:not(:last-child)]:border-r">
              <TableHead className="border-r w-80 print:text-black">Student Name</TableHead>
              <TableHead className="border-r w-36 print:hidden">Name in Use</TableHead>
              <TableHead className="border-r w-52 print:text-black">Reg. No</TableHead>
              {meetEvents.map((event) => {
                const isColumnFull = (columnCounts[event] || 0) > 2;
                return (
                  <TableHead
                    className={cn(
                      "h-auto border-r px-2 py-3 text-center align-bottom print:text-black print:p-1",
                      isColumnFull && "bg-destructive/10 text-destructive font-bold"
                    )}
                    key={event}
                  >
                    <span className="block w-6 whitespace-nowrap [writing-mode:vertical-rl] rotate-180 mx-auto print:text-xs">
                      {event}
                    </span>
                  </TableHead>
                )
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
                <TableCell colSpan={meetEvents.length + 4} className="h-24 text-center">
                  Please select a meet to start registering.
                </TableCell>
              </TableRow>
            )}

            {selectedMeetId && fields.map((field, index) => {
              // Retrieve gender from current form data if available, else fallback to field
              const gender = (field as any).student?.gender;
              const faculty = (field as any).student?.faculty;

              if (gender !== activeTab || faculty !== selectedFaculty) return null;

              return (
                <RegistrationRow
                  key={field.id}
                  index={index}
                  form={form}
                  remove={remove}
                  columnCounts={columnCounts}
                  availableEvents={meetEvents}
                />
              )
            })}

            {/* Add New Row - Only if meet selected */}
            {selectedMeetId && (
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
                {meetEvents.map((event) => {
                  return (
                    <TableHead
                      className="h-auto border-r px-2 py-3 text-center align-bottom print:text-black print:p-1"
                      key={event}
                    />
                  )
                })}
                <TableHead className="print:hidden" />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {!selectedMeetId ? (
          <div className="p-8 text-center text-muted-foreground border rounded-lg">
            Please select a meet above.
          </div>
        ) : (
          <>
            <MobileRegistrationView
              form={form}
              fields={fields}
              remove={remove}
              activeTab={activeTab}
              columnCounts={columnCounts}
              selectedFaculty={selectedFaculty}
              availableEvents={meetEvents}
            />
            <Button onClick={handleAddNew} className="w-full" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
