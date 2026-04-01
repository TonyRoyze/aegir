"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { SWIM_EVENTS } from "@/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Loader2, Plus, Calendar as CalendarIcon, Archive, RefreshCcw, Pencil, Trash2 } from "lucide-react"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface Meet {
  _id: Id<"meets">;
  name: string;
  date: string;
  events: string[];
  status?: string;
}

export default function MeetsPage() {
  const meets = useQuery(api.meets.getMeets)
  const createMeet = useMutation(api.meets.createMeet)
  const updateStatus = useMutation(api.meets.updateStatus)
  const updateMeet = useMutation(api.meets.updateMeet)
  const deleteMeet = useMutation(api.meets.deleteMeet)

  const [isCreating, setIsCreating] = useState(false)
  const [newMeetName, setNewMeetName] = useState("")
  const [newMeetDate, setNewMeetDate] = useState<Date | undefined>(new Date())
  const [selectedEvents, setSelectedEvents] = useState<string[]>([...SWIM_EVENTS]) // Default to all

  // Edit state
  const [editingMeet, setEditingMeet] = useState<Meet | null>(null)
  const [editName, setEditName] = useState("")
  const [editDate, setEditDate] = useState<Date | undefined>(undefined)
  const [editEvents, setEditEvents] = useState<string[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // Delete state
  const [deletingMeet, setDeletingMeet] = useState<Meet | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleCreate = async () => {
    if (!newMeetName || !newMeetDate) return
    setIsCreating(true)
    try {
      await createMeet({
        name: newMeetName,
        date: newMeetDate.toISOString(),
        events: selectedEvents,
      })
      setNewMeetName("")
      setNewMeetDate(undefined)
      // setSelectedEvents([...SWIM_EVENTS]) // Keep selection or reset?
    } catch (error) {
      console.error("Failed to create meet:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleStatusChange = async (id: Id<"meets">, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "archived" : "active"
    await updateStatus({ id, status: newStatus as "active" | "archived" })
  }

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    )
  }

  const toggleEditEvent = (event: string) => {
    setEditEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    )
  }

  const openEditDialog = (meet: Meet) => {
    setEditingMeet(meet)
    setEditName(meet.name)
    setEditDate(new Date(meet.date))
    setEditEvents([...meet.events])
    setEditDialogOpen(true)
  }

  const handleEdit = async () => {
    if (!editingMeet || !editName || !editDate) return
    setIsEditing(true)
    try {
      await updateMeet({
        id: editingMeet._id,
        name: editName,
        date: editDate.toISOString(),
        events: editEvents,
      })
      setEditDialogOpen(false)
      setEditingMeet(null)
    } catch (error) {
      console.error("Failed to update meet:", error)
    } finally {
      setIsEditing(false)
    }
  }

  const openDeleteDialog = (meet: Meet) => {
    setDeletingMeet(meet)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingMeet) return
    setIsDeleting(true)
    try {
      await deleteMeet({ id: deletingMeet._id })
      setDeleteDialogOpen(false)
      setDeletingMeet(null)
    } catch (error) {
      console.error("Failed to delete meet:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8 p-6 md:p-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meets</h1>
        <p className="text-muted-foreground">Manage swimming meets and their events.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Create New Meet */}
        <Card>
          <CardHeader>
            <CardTitle>Create New Meet</CardTitle>
            <CardDescription>Set up a new meet with specific events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                      !newMeetDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newMeetDate ? format(newMeetDate, "PPP") : <span>Pick a date</span>}
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
            <div className="space-y-2">
              <Label>Events Included</Label>
              <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto rounded-md p-2">
                {SWIM_EVENTS.map(event => (
                  <div key={event} className="flex items-center space-x-2">
                    <Checkbox
                      id={`event-${event}`}
                      checked={selectedEvents.includes(event)}
                      onCheckedChange={() => toggleEvent(event)}
                    />
                    <Label
                      htmlFor={`event-${event}`}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {event}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={isCreating || !newMeetName} className="w-full">
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create Meet
            </Button>
          </CardContent>
        </Card>

        {/* List of Meets */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Active Meets</h2>
          {meets === undefined ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : meets.length === 0 ? (
            <div className="text-center p-8 border rounded-lg border-dashed text-muted-foreground">
              No meets created yet.
            </div>
          ) : (
            meets.map((meet) => (
              <Card key={meet._id} className={cn(meet.status === "archived" && "opacity-60")}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{meet.name}</CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {new Date(meet.date).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-medium px-2 py-1 rounded-full capitalize", meet.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700")}>
                        {meet.status}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(meet)}
                        title="Edit Meet"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStatusChange(meet._id, meet.status!)}
                        title={meet.status === "active" ? "Archive Meet" : "Activate Meet"}
                      >
                        {meet.status === "active" ? <Archive className="h-4 w-4" /> : <RefreshCcw className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(meet)}
                        title="Delete Meet"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {meet.events.length} events configured
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
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
                      !editDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? format(editDate, "PPP") : <span>Pick a date</span>}
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
            <div className="space-y-2">
              <Label>Events Included ({editEvents.length} selected)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto rounded-md border p-2">
                {SWIM_EVENTS.map(event => (
                  <div key={event} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-event-${event}`}
                      checked={editEvents.includes(event)}
                      onCheckedChange={() => toggleEditEvent(event)}
                    />
                    <Label
                      htmlFor={`edit-event-${event}`}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {event}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isEditing || !editName}>
              {isEditing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
              This action cannot be undone. This will permanently delete the meet
              <span className="font-semibold text-foreground"> {deletingMeet?.name} </span>
              and all associated data including student registrations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Meet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

