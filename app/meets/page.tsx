"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeetConfigurationFields } from "@/components/meet-configuration-fields";
import {
  eventLabel,
  normalizeTeam,
  validateConfiguration,
  type EventInput,
  type TeamInput,
} from "@/lib/meet-configuration";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Plus,
  Calendar as CalendarIcon,
  Archive,
  RefreshCcw,
  Pencil,
  Trash2,
  Link,
  Unlink,
  Copy,
  Check,
} from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Meet = FunctionReturnType<typeof api.meets.getMeets>[number];

const DEFAULT_POINT_SYSTEM = [7, 5, 4, 3, 2, 1];

export default function MeetsPage() {
  const meets = useQuery(api.meets.getMeets);
  const createMeet = useMutation(api.meets.createMeet);
  const updateStatus = useMutation(api.meets.updateStatus);
  const updateMeet = useMutation(api.meets.updateMeet);
  const deleteMeet = useMutation(api.meets.deleteMeet);
  const generatePublicToken = useMutation(api.meets.generatePublicToken);

  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMeetName, setNewMeetName] = useState("");
  const [newMeetDate, setNewMeetDate] = useState<Date | undefined>(new Date());
  const [selectedEvents, setSelectedEvents] = useState<EventInput[]>([]);
  const [newTeams, setNewTeams] = useState<TeamInput[]>([]);
  const [editTeams, setEditTeams] = useState<TeamInput[]>([]);
  const [formError, setFormError] = useState("");

  // Edit state
  const [editingMeet, setEditingMeet] = useState<Meet | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editEvents, setEditEvents] = useState<EventInput[]>([]);
  const [editPointSystem, setEditPointSystem] = useState<number[]>([
    ...DEFAULT_POINT_SYSTEM,
  ]);
  const [editEventPointSystems, setEditEventPointSystems] = useState<
    Record<string, number[]>
  >({});
  const [isEditing, setIsEditing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [newPointSystem, setNewPointSystem] = useState<number[]>([
    ...DEFAULT_POINT_SYSTEM,
  ]);
  const [newEventPointSystems, setNewEventPointSystems] = useState<
    Record<string, number[]>
  >({});

  // Delete state
  const [deletingMeet, setDeletingMeet] = useState<Meet | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Public link state
  const [publicLinkMeet, setPublicLinkMeet] = useState<Meet | null>(null);
  const [publicLinkDialogOpen, setPublicLinkDialogOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!newMeetName || !newMeetDate) return;
    setIsCreating(true);
    try {
      setFormError("");
      validateConfiguration(newTeams, selectedEvents);
      await createMeet({
        name: newMeetName,
        date: newMeetDate.toISOString(),
        events: selectedEvents.map(eventLabel),
        configuredEvents: selectedEvents.map((e) => ({
          ...e,
          id: e.id as Id<"meetEvents"> | undefined,
        })),
        teams: newTeams.map((t) => ({
          ...t,
          id: t.id as Id<"meetTeams"> | undefined,
        })),
        pointSystem: newPointSystem,
        eventPointSystems: newEventPointSystems,
      });
      setNewMeetName("");
      setNewMeetDate(undefined);
      setNewPointSystem([...DEFAULT_POINT_SYSTEM]);
      setNewEventPointSystems({});
      setSelectedEvents([]);
      setNewTeams([]);
      setShowCreateForm(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not create meet.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusChange = async (id: Id<"meets">, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "archived" : "active";
    await updateStatus({ id, status: newStatus as "active" | "archived" });
  };

  const openEditDialog = (meet: Meet) => {
    setEditingMeet(meet);
    setEditName(meet.name);
    setEditDate(new Date(meet.date));
    setEditEvents(meet.configuredEvents.map((e) => ({ ...e })));
    setEditTeams((meet.teams ?? []).map(normalizeTeam));
    setFormError("");
    setEditPointSystem(meet.pointSystem || [...DEFAULT_POINT_SYSTEM]);
    setEditEventPointSystems(meet.eventPointSystems || {});
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editingMeet || !editName || !editDate) return;
    setIsEditing(true);
    try {
      setFormError("");
      validateConfiguration(editTeams, editEvents);
      await updateMeet({
        id: editingMeet._id,
        name: editName,
        date: editDate.toISOString(),
        events: editEvents.map(eventLabel),
        configuredEvents: editEvents.map((e) => ({
          ...e,
          id: e.id as Id<"meetEvents"> | undefined,
        })),
        teams: editTeams.map((t) => ({
          ...t,
          id: t.id as Id<"meetTeams"> | undefined,
        })),
        pointSystem: editPointSystem,
        eventPointSystems: editEventPointSystems,
      });
      setEditDialogOpen(false);
      setEditingMeet(null);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not save meet.",
      );
    } finally {
      setIsEditing(false);
    }
  };

  const openDeleteDialog = (meet: Meet) => {
    setDeletingMeet(meet);
    setDeleteDialogOpen(true);
  };

  const openPublicLinkDialog = (meet: Meet) => {
    setPublicLinkMeet(meet);
    setGeneratedToken(meet.publicToken || null);
    setPublicLinkDialogOpen(true);
    setCopied(false);
  };

  const handleGeneratePublicLink = async () => {
    if (!publicLinkMeet) return;
    setIsGeneratingLink(true);
    try {
      const token = await generatePublicToken({ meetId: publicLinkMeet._id });
      setGeneratedToken(token);
    } catch (error) {
      console.error("Failed to generate public link:", error);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyPublicLink = async () => {
    if (!generatedToken) return;
    const url = `${window.location.origin}/meets/public/${generatedToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!deletingMeet) return;
    setIsDeleting(true);
    try {
      await deleteMeet({ id: deletingMeet._id });
      setDeleteDialogOpen(false);
      setDeletingMeet(null);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not delete meet.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 p-6 md:p-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {showCreateForm ? "Create a Meet" : "Meets"}
          </h1>
          <p className="text-muted-foreground">
            {showCreateForm
              ? "Set up the meet, teams, events, and points."
              : "Manage swimming meets and their events."}
          </p>
        </div>
        {showCreateForm ? (
          <Button variant="outline" onClick={() => setShowCreateForm(false)}>
            Cancel
          </Button>
        ) : (
          <Button
            onClick={() => {
              setFormError("");
              setShowCreateForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Meet
          </Button>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-destructive">
          {formError}
        </p>
      )}
      <div
        className={cn(
          "grid gap-8",
          showCreateForm
            ? "grid-cols-1"
            : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {/* Create New Meet */}
        {showCreateForm && (
          <Card className="mx-auto w-full max-w-7xl">
          <CardHeader>
            <CardTitle>Create New Meet</CardTitle>
            <CardDescription>
              Set up a new meet with specific events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Meet Name</Label>
              <Input
                placeholder="e.g. Annual Inter-Faculty Meet 2024"
                value={newMeetName}
                onChange={(e) => setNewMeetName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newMeetDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newMeetDate ? (
                      format(newMeetDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={newMeetDate}
                    onSelect={setNewMeetDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
            </div>
            <MeetConfigurationFields
              teams={newTeams}
              events={selectedEvents}
              onTeamsChange={setNewTeams}
              onEventsChange={setSelectedEvents}
              pointSystem={newPointSystem}
              eventPointSystems={newEventPointSystems}
              onPointsChange={setNewEventPointSystems}
            />

            <Button
              onClick={handleCreate}
              disabled={isCreating || !newMeetName}
              className="w-full"
            >
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create Meet
            </Button>
          </CardContent>
          </Card>
        )}

        {/* List of Meets */}
        {!showCreateForm && (
          <div className="col-span-full space-y-4">
            <h2 className="text-xl font-semibold">All Meets</h2>
            {meets === undefined ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : meets.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                No meets created yet.
              </div>
            ) : (
              <Table className="min-w-190">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="border-r">Meet</TableHead>
                    <TableHead className="w-40 border-r">Date</TableHead>
                    <TableHead className="w-40 border-r">Events</TableHead>
                    <TableHead className="w-36 border-r">Status</TableHead>
                    <TableHead className="w-52 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meets.map((meet) => (
                    <TableRow
                      key={meet._id}
                      className={cn(
                        "hover:bg-muted/30",
                        meet.status === "archived" && "text-muted-foreground",
                      )}
                    >
                      <TableCell className="border-r font-medium">
                        {meet.name}
                      </TableCell>
                      <TableCell className="border-r">
                        <span className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          {new Date(meet.date).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="border-r">
                        {meet.events.length}
                      </TableCell>
                      <TableCell className="border-r">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize",
                            meet.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700",
                          )}
                        >
                          {meet.status}
                        </span>
                      </TableCell>
                      <TableCell className="p-0">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openPublicLinkDialog(meet)}
                            title={
                              meet.publicToken
                                ? "Public Link"
                                : "Generate Public Link"
                            }
                            aria-label={`Public link for ${meet.name}`}
                          >
                            {meet.publicToken ? (
                              <Link className="h-4 w-4" />
                            ) : (
                              <Unlink className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(meet)}
                            title="Edit Meet"
                            aria-label={`Edit ${meet.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleStatusChange(meet._id, meet.status!)
                            }
                            title={
                              meet.status === "active"
                                ? "Archive Meet"
                                : "Activate Meet"
                            }
                            aria-label={`${meet.status === "active" ? "Archive" : "Activate"} ${meet.name}`}
                          >
                            {meet.status === "active" ? (
                              <Archive className="h-4 w-4" />
                            ) : (
                              <RefreshCcw className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(meet)}
                            title="Delete Meet"
                            aria-label={`Delete ${meet.name}`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Meet</DialogTitle>
            <DialogDescription>
              Update meet details and events.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Meet Name</Label>
              <Input
                placeholder="e.g. Annual Inter-Faculty Meet 2024"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? (
                      format(editDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editDate}
                    onSelect={setEditDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <MeetConfigurationFields
              teams={editTeams}
              events={editEvents}
              onTeamsChange={setEditTeams}
              onEventsChange={setEditEvents}
              pointSystem={editPointSystem}
              eventPointSystems={editEventPointSystems}
              onPointsChange={setEditEventPointSystems}
            />

          </div>
          {formError && (
            <p role="alert" className="text-destructive">
              {formError}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isEditing || !editName}>
              {isEditing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              meet
              <span className="font-semibold text-foreground">
                {" "}
                {deletingMeet?.name}{" "}
              </span>
              and all associated data including student registrations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete Meet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Public Link Dialog */}
      <Dialog
        open={publicLinkDialogOpen}
        onOpenChange={setPublicLinkDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Public Leaderboard Link</DialogTitle>
            <DialogDescription>
              Share this link to show the leaderboard without requiring login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!generatedToken ? (
              <Button
                onClick={handleGeneratePublicLink}
                disabled={isGeneratingLink}
              >
                {isGeneratingLink ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link className="mr-2 h-4 w-4" />
                )}
                Generate Public Link
              </Button>
            ) : (
              <div className="space-y-2">
                <Label>Share this link:</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/meets/public/${generatedToken}`}
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={copyPublicLink}
                    variant="outline"
                    size="icon"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Anyone with this link can view the faculty and event
                  leaderboards without logging in.
                </p>
              </div>
            )}
          </div>
          {formError && (
            <p role="alert" className="text-destructive">
              {formError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPublicLinkDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
