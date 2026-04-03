"use client"

import { UseFormReturn, useWatch } from "react-hook-form"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Trash2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// Define the shape of FormValues locally to avoid circular dependencies
// This matches the structure in RegistrationForm.tsx
type FormValues = {
  registrations: {
    id: string
    student: {
      id: string
      name: string
      registrationNumber: string
      nameInUse: string
      gender?: "Male" | "Female"
      faculty?: string
    }
    events: string[]
    registeredAt: string | Date
  }[]
}

interface MobileRegistrationFormProps {
  form: UseFormReturn<FormValues>
  fields: any[] // fields from useFieldArray
  remove: (index: number) => void
  activeTab: "Male" | "Female"
  selectedFaculty: string
  columnCounts?: Record<string, number>
  availableEvents: string[] | readonly string[]
}

const MobileStudentItem = ({
  index,
  form,
  remove,
  columnCounts,
  availableEvents
}: {
  index: number
  form: UseFormReturn<FormValues>
  remove: (index: number) => void
  columnCounts?: Record<string, number>
  availableEvents: string[] | readonly string[]
}) => {
  const events = useWatch({
    control: form.control,
    name: `registrations.${index}.events`,
    defaultValue: [],
  })

  // Rule: Max 3 individual events. Last 3 columns (typically relays) are excluded.
  const eventsToExclude = availableEvents.slice(-3);
  const eventsToCheckLimit = events ? events.filter(e => !eventsToExclude.includes(e)) : [];
  const isRowLimitExceeded = eventsToCheckLimit.length > 3;

  // Watch name for the trigger label
  const name = useWatch({
    control: form.control,
    name: `registrations.${index}.student.name`,
  })

  const registrationNumber = useWatch({
    control: form.control,
    name: `registrations.${index}.student.registrationNumber`,
  })

  return (
    <AccordionItem value={`item-${index}`} className={cn(isRowLimitExceeded && "border-destructive")}>
      <AccordionTrigger className={cn("px-4 hover:no-underline", isRowLimitExceeded && "text-destructive")}>
        <div className="flex flex-col items-start gap-2 text-left w-full overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{name || "New Student"}</span>
            {isRowLimitExceeded && <AlertCircle className="h-4 w-4 text-destructive" />}
          </div>

          {events && events.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {events.slice(0, 3).map((event) => {
                const limit = event.includes("Relay") ? 4 : 2;
                const count = columnCounts ? (columnCounts[event] || 0) : 0;
                const isColumnLimitExceeded = count > limit;
                const isColumnFull = count === limit;

                return (
                  <span
                    key={event}
                    className={cn(
                      "inline-flex items-center rounded-full border-transparent px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      isColumnLimitExceeded || isRowLimitExceeded
                        ? "bg-destructive/10 text-destructive"
                        : isColumnFull ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"
                    )}
                  >
                    {event.replace(/^([MW]):/, "")}
                  </span>
                );
              })}
              {events.length > 3 && (
                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-muted text-muted-foreground">
                  +{events.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 space-y-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Student Name</label>
            <Input
              {...form.register(`registrations.${index}.student.name`)}
              placeholder="e.g. John Doe"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name in Use</label>
              <Input
                {...form.register(`registrations.${index}.student.nameInUse`)}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reg. No</label>
              <Input
                {...form.register(`registrations.${index}.student.registrationNumber`)}
                placeholder="2024s..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium mb-2 block">Events ({events?.length || 0})</label>
            <Combobox
              items={availableEvents.map(e => ({ label: e.replace(/^([MW]):/, ""), value: e }))}
              multiple
              value={(events || []).map(e => ({ label: e.replace(/^([MW]):/, ""), value: e }))}
              onValueChange={(val) => {
                form.setValue(`registrations.${index}.events`, val.map(v => v.value))
              }}
            >
              <ComboboxChips>
                <ComboboxValue>
                  {(value: { value: string; label: string }[]) => (
                    <>
                      {value?.map((item) => (
                        <ComboboxChip aria-label={item.label} key={item.value}>
                          {item.label}
                        </ComboboxChip>
                      ))}
                      <ComboboxInput
                        aria-label="Select events"
                        placeholder={value.length > 0 ? undefined : "Select events..."}
                      />
                    </>
                  )}
                </ComboboxValue>
              </ComboboxChips>
              <ComboboxPopup>
                <ComboboxEmpty>No events found.</ComboboxEmpty>
                <ComboboxList>
                  {(item) => {
                    const limit = item.value.includes("Relay") ? 4 : 2;
                    const count = columnCounts ? (columnCounts[item.value] || 0) : 0;
                    const isColumnLimitExceeded = count > limit;

                    return (
                      <ComboboxItem
                        key={item.value}
                        value={item}
                        className={cn(isColumnLimitExceeded && "text-destructive font-medium")}
                      >
                        {item.label}
                      </ComboboxItem>
                    )
                  }}
                </ComboboxList>
              </ComboboxPopup>
            </Combobox>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => remove(index)}
            className="w-full mt-2"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove Student
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export function MobileRegistrationFrom({
  form,
  fields,
  remove,
  activeTab,
  columnCounts,
  selectedFaculty,
  availableEvents
}: MobileRegistrationFormProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <Accordion type="single" collapsible className="w-full">
          {fields.map((field, index) => {
            // Access gender safely - field.student might differ in shape if using FieldArrayWithId
            // But usually it keeps the structure.
            const gender = (field as any).student?.gender;
            const faculty = (field as any).student?.faculty;

            if (gender !== activeTab || faculty !== selectedFaculty) return null;

            return (
              <MobileStudentItem
                key={field.id}
                index={index}
                form={form}
                remove={remove}
                columnCounts={columnCounts}
                availableEvents={availableEvents}
              />
            )
          })}
        </Accordion>
        {fields.filter((f: any) => f.student?.gender === activeTab && f.student?.faculty === selectedFaculty).length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab.toLowerCase()} students from {selectedFaculty} added yet.
          </div>
        )}
      </div>
    </div>
  )
}
