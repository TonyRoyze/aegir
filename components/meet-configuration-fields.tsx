"use client";
import { Fragment, useId, useState } from "react";
import { Pencil, Check, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import {
  STROKES,
  eventLabel,
  readableEventLabel,
  validateConfiguration,
  type TeamInput,
  type EventInput,
  type EventGender,
} from "@/lib/meet-configuration";

function StrokeCombobox({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {[
              ...new Set([
                ...options,
                ...(value && !options.includes(value) ? [value] : []),
              ]),
            ].map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
function RowActions({
  label,
  editing,
  onEdit,
  onRemove,
}: {
  label: string;
  editing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`${editing ? "Finish editing" : "Edit"} ${label}`}
        aria-expanded={editing}
        onClick={onEdit}
      >
        {editing ? (
          <Check data-icon="inline-start" />
        ) : (
          <Pencil data-icon="inline-start" />
        )}
        {/*{editing ? "Done" : "Edit"}*/}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
export function MeetConfigurationFields({
  teams,
  events,
  onTeamsChange,
  onEventsChange,
  pointSystem,
  eventPointSystems,
  onPointsChange,
}: {
  teams: TeamInput[];
  events: EventInput[];
  onTeamsChange: (teams: TeamInput[]) => void;
  onEventsChange: (events: EventInput[]) => void;
  pointSystem: number[];
  eventPointSystems: Record<string, number[]>;
  onPointsChange: (points: Record<string, number[]>) => void;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  const [distance, setDistance] = useState("100");
  const [stroke, setStroke] = useState("Freestyle");
  const [gender, setGender] = useState<EventGender>("Male");
  const [legs, setLegs] = useState("4");
  const [error, setError] = useState("");
  const [editingTeam, setEditingTeam] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<number | null>(null);
  const [pointDrafts, setPointDrafts] = useState<Record<string, string>>({});
  const [pointErrors, setPointErrors] = useState<Record<string, string>>({});
  const updateTeam = (index: number, patch: Partial<TeamInput>) =>
    onTeamsChange(
      teams.map((team, i) => (i === index ? { ...team, ...patch } : team)),
    );
  const updateEvent = (index: number, patch: Partial<EventInput>) => {
    const previous = events[index];
    const updated = { ...previous, ...patch };
    if (
      !previous.id &&
      eventLabel(previous) !== eventLabel(updated) &&
      eventPointSystems[eventLabel(previous)]
    ) {
      const next = {
        ...eventPointSystems,
        [eventLabel(updated)]: eventPointSystems[eventLabel(previous)],
      };
      delete next[eventLabel(previous)];
      onPointsChange(next);
    }
    onEventsChange(events.map((event, i) => (i === index ? updated : event)));
  };
  const addTeam = () => {
    try {
      const next = [
        ...teams,
        {
          code: code.trim(),
        },
      ];
      validateConfiguration(next, events);
      onTeamsChange(next);
      setCode("");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const addEvent = () => {
    try {
      const next = [
        ...events,
        {
          distance: Number(distance),
          stroke: stroke.trim(),
          gender,
          ...(stroke.toLowerCase().includes("relay")
            ? { legs: Number(legs) }
            : {}),
        },
      ];
      validateConfiguration(teams, next);
      onEventsChange(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <FieldGroup>
      <FieldSet>
        {/*<FieldLegend>Teams</FieldLegend>
        <FieldDescription>
          Team codes belong only to this meet.
        </FieldDescription>*/}
        <FieldGroup className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field>
            <FieldLabel htmlFor={`${id}-team`}>Team code</FieldLabel>
            <Input
              id={`${id}-team`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              placeholder="Type a team code"
            />
          </Field>
          <Button type="button" variant="outline" onClick={addTeam}>
            <Plus data-icon="inline-start" />
            Add team
          </Button>
        </FieldGroup>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="border-r">Team code</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team, index) => (
              <TableRow key={team.id ?? index} className="hover:bg-muted/20">
                <TableCell className="border-r p-0">
                  {editingTeam === index ? (
                    <Input
                      id={`${id}-team-${index}`}
                      aria-label={`Team code for ${team.code}`}
                      autoFocus
                      value={team.code}
                      onChange={(e) =>
                        updateTeam(index, { code: e.target.value })
                      }
                      className="h-10 border-0 bg-transparent shadow-none rounded-none px-3 focus-visible:ring-0 focus-visible:ring-inset focus-visible:ring-primary"
                    />
                  ) : (
                    <span className="block px-3 py-2">{team.code}</span>
                  )}
                </TableCell>
                <TableCell className="px-2">
                  <RowActions
                    label={team.code}
                    editing={editingTeam === index}
                    onEdit={() =>
                      setEditingTeam(editingTeam === index ? null : index)
                    }
                    onRemove={() => {
                      onTeamsChange(teams.filter((_, i) => i !== index));
                      setEditingTeam(null);
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!teams.length && (
          <FieldDescription>No teams added yet.</FieldDescription>
        )}
      </FieldSet>
      <FieldSet>
        <FieldLegend>Events</FieldLegend>
        <FieldDescription>
          Choose distance, stroke and gender separately.
        </FieldDescription>
        <FieldGroup className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field>
            <FieldLabel htmlFor={`${id}-distance`}>Distance (m)</FieldLabel>
            <Input
              id={`${id}-distance`}
              type="number"
              min="0.01"
              step="any"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </Field>
          <StrokeCombobox
            id={`${id}-stroke`}
            label="Stroke"
            value={stroke}
            options={STROKES}
            onChange={setStroke}
          />
          <Field>
            <FieldLabel htmlFor={`${id}-gender`}>Gender</FieldLabel>
            <Select
              value={gender}
              onValueChange={(value) => setGender(value as EventGender)}
            >
              <SelectTrigger id={`${id}-gender`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="Male">Men</SelectItem>
                  <SelectItem value="Female">Women</SelectItem>
                  <SelectItem value="Mixed">Mixed / Open</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {stroke.toLowerCase().includes("relay") && (
            <Field>
              <FieldLabel htmlFor={`${id}-legs`}>Relay legs</FieldLabel>
              <Input
                id={`${id}-legs`}
                type="number"
                min="1"
                max="20"
                value={legs}
                onChange={(e) => setLegs(e.target.value)}
              />
            </Field>
          )}
          <Button type="button" variant="outline" onClick={addEvent}>
            <Plus data-icon="inline-start" />
            Add event
          </Button>
        </FieldGroup>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="border-r">Event</TableHead>
              <TableHead className="min-w-64 border-r">Points</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event, index) => {
              const key = event.id ?? eventLabel(event);
              return (
                <Fragment key={event.id ?? index}>
                  <TableRow className="hover:bg-muted/20">
                    <TableCell className="border-r whitespace-normal">
                      {readableEventLabel(event)}
                    </TableCell>
                    <TableCell className="border-r p-0">
                      <div className="flex min-w-0 items-start gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <Input
                            className="h-10 border-0 bg-transparent shadow-none rounded-none px-4 focus-visible:ring-0 focus-visible:ring-inset focus-visible:ring-primary"
                            aria-label={`Points for ${readableEventLabel(event)}`}
                            value={
                              pointDrafts[key] ??
                              (eventPointSystems[key] ?? pointSystem).join(",")
                            }
                            aria-invalid={Boolean(pointErrors[key])}
                            placeholder="7,5,4,3,2,1"
                            onChange={(e) => {
                              const value = e.target.value;
                              setPointDrafts((drafts) => ({
                                ...drafts,
                                [key]: value,
                              }));
                              setPointErrors((errors) => ({
                                ...errors,
                                [key]: "",
                              }));
                            }}
                            onBlur={() => {
                              const draft = pointDrafts[key];
                              if (draft === undefined) return;
                              const trimmed = draft.trim();
                              if (!/^\d+(\s*,\s*\d+)*$/.test(trimmed)) {
                                setPointErrors((errors) => ({
                                  ...errors,
                                  [key]: "Use comma-separated whole numbers.",
                                }));
                                return;
                              }
                              onPointsChange({
                                ...eventPointSystems,
                                [key]: trimmed
                                  .split(",")
                                  .map((value) => Number(value.trim())),
                              });
                              setPointDrafts((drafts) => {
                                const next = { ...drafts };
                                delete next[key];
                                return next;
                              });
                              setPointErrors((errors) => ({
                                ...errors,
                                [key]: "",
                              }));
                            }}
                          />
                          {pointErrors[key] && (
                            <FieldError role="alert">
                              {pointErrors[key]}
                            </FieldError>
                          )}
                        </div>
                        {eventPointSystems[key] && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const next = { ...eventPointSystems };
                              delete next[key];
                              onPointsChange(next);
                              setPointDrafts((drafts) => {
                                const updated = { ...drafts };
                                delete updated[key];
                                return updated;
                              });
                              setPointErrors((errors) => {
                                const updated = { ...errors };
                                delete updated[key];
                                return updated;
                              });
                            }}
                          >
                            Default
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-2">
                      <RowActions
                        label={readableEventLabel(event)}
                        editing={editingEvent === index}
                        onEdit={() =>
                          setEditingEvent(editingEvent === index ? null : index)
                        }
                        onRemove={() => {
                          onEventsChange(events.filter((_, i) => i !== index));
                          setEditingEvent(null);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                  {editingEvent === index && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3}>
                        <FieldGroup className="grid gap-3 py-2 sm:grid-cols-2 xl:grid-cols-4">
                          <Field>
                            <FieldLabel htmlFor={`${id}-distance-${index}`}>
                              Distance (m)
                            </FieldLabel>
                            <Input
                              id={`${id}-distance-${index}`}
                              type="number"
                              min="0.01"
                              step="any"
                              value={event.distance}
                              onChange={(e) =>
                                updateEvent(index, {
                                  distance: Number(e.target.value),
                                })
                              }
                            />
                          </Field>
                          <StrokeCombobox
                            id={`${id}-stroke-${index}`}
                            label="Stroke"
                            value={event.stroke}
                            options={STROKES}
                            onChange={(stroke) =>
                              updateEvent(index, { stroke })
                            }
                          />
                          <Field>
                            <FieldLabel htmlFor={`${id}-gender-${index}`}>
                              Gender
                            </FieldLabel>
                            <Select
                              value={event.gender ?? "Mixed"}
                              onValueChange={(value) =>
                                updateEvent(index, {
                                  gender: value as EventGender,
                                })
                              }
                            >
                              <SelectTrigger id={`${id}-gender-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="Male">Men</SelectItem>
                                  <SelectItem value="Female">Women</SelectItem>
                                  <SelectItem value="Mixed">
                                    Mixed / Open
                                  </SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>
                          {event.stroke.toLowerCase().includes("relay") && (
                            <Field>
                              <FieldLabel htmlFor={`${id}-legs-${index}`}>
                                Relay legs
                              </FieldLabel>
                              <Input
                                id={`${id}-legs-${index}`}
                                type="number"
                                min="1"
                                max="20"
                                value={event.legs ?? 1}
                                onChange={(e) =>
                                  updateEvent(index, {
                                    legs: Number(e.target.value),
                                  })
                                }
                              />
                            </Field>
                          )}
                        </FieldGroup>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        {!events.length && (
          <FieldDescription>No events added yet.</FieldDescription>
        )}
      </FieldSet>
      {error && <FieldError role="alert">{error}</FieldError>}
    </FieldGroup>
  );
}
