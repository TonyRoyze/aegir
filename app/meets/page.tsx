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
import { Loader2, Plus, Calendar as CalendarIcon, Archive, RefreshCcw, Pencil, Trash2, Settings2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface Meet {
  _id: Id<"meets">;
  name: string;
  date: string;
  events: string[];
  status?: string;
  pointSystem?: number[];
  eventPointSystems?: Record<string, number[]>;
}

const DEFAULT_POINT_SYSTEM = [7, 5, 4, 3, 2, 1];

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
  const [editPointSystem, setEditPointSystem] = useState<number[]>([...DEFAULT_POINT_SYSTEM])
  const [editEventPointSystems, setEditEventPointSystems] = useState<Record<string, number[]>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const [newPointSystem, setNewPointSystem] = useState<number[]>([...DEFAULT_POINT_SYSTEM])
  const [newEventPointSystems, setNewEventPointSystems] = useState<Record<string, number[]>>({})

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
        pointSystem: newPointSystem,
        eventPointSystems: newEventPointSystems,
      })
      setNewMeetName("")
      setNewMeetDate(undefined)
      setNewPointSystem([...DEFAULT_POINT_SYSTEM])
      setNewEventPointSystems({})
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

  const toggleEvent = (gender: 'M' | 'W', baseEvent: string) => {
    const fullEvent = `${gender}:${baseEvent}`
    setSelectedEvents(prev =>
      prev.includes(fullEvent)
        ? prev.filter(e => e !== fullEvent)
        : [...prev, fullEvent]
    )
  }

  const toggleEditEvent = (gender: 'M' | 'W', baseEvent: string) => {
    const fullEvent = `${gender}:${baseEvent}`
    setEditEvents(prev =>
      prev.includes(fullEvent)
        ? prev.filter(e => e !== fullEvent)
        : [...prev, fullEvent]
    )
  }

  const openEditDialog = (meet: Meet) => {
    setEditingMeet(meet)
    setEditName(meet.name)
    setEditDate(new Date(meet.date))
    setEditEvents([...meet.events])
    setEditPointSystem(meet.pointSystem || [...DEFAULT_POINT_SYSTEM])
    setEditEventPointSystems(meet.eventPointSystems || {})
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
        pointSystem: editPointSystem,
        eventPointSystems: editEventPointSystems,
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
            <div className="space-y-4">
              <div className="rounded-md border bg-neutral-50/50">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Events Included</TableHead>
                      <TableHead className="w-12 text-center text-[10px] font-black uppercase tracking-widest h-10 px-0">Men</TableHead>
                      <TableHead className="w-12 text-center text-[10px] font-black uppercase tracking-widest h-10 px-0">Women</TableHead>
                      <TableHead className="w-12 text-center text-[10px] font-black uppercase tracking-widest h-10 px-0">Pts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="max-h-80 overflow-y-auto">
                    {SWIM_EVENTS.map(event => {
                      const mEvent = `M:${event}`;
                      const wEvent = `W:${event}`;
                      const mChecked = selectedEvents.includes(mEvent);
                      const wChecked = selectedEvents.includes(wEvent);

                      return (
                        <TableRow key={event} className="group hover:bg-white border-b-0">
                          <TableCell className="py-2 font-medium text-sm text-neutral-700">{event}</TableCell>
                          
                          <TableCell className="w-12 py-2 px-0 text-center">
                            <Checkbox
                              id={`event-m-${event}`}
                              checked={mChecked}
                              onCheckedChange={() => toggleEvent('M', event)}
                              className="h-4 w-4 border-slate-300 mx-auto"
                            />
                          </TableCell>
                          
                          <TableCell className="w-12 py-2 px-0 text-center">
                            <Checkbox
                              id={`event-w-${event}`}
                              checked={wChecked}
                              onCheckedChange={() => toggleEvent('W', event)}
                              className="h-4 w-4 border-slate-300 mx-auto"
                            />
                          </TableCell>

                          <TableCell className="w-12 py-2 px-0 text-center">
                            {(mChecked || wChecked) && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100 transition-opacity p-0 mx-auto">
                                    <Settings2 className="h-3.5 w-3.5" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-4" side="left">
                                   <h4 className="font-black text-xs uppercase mb-1 text-neutral-400">Override Points</h4>
                                   <p className="text-[10px] text-muted-foreground mb-4 uppercase tracking-tighter">Event: {event}</p>
                                   <div className="grid grid-cols-4 gap-2">
                                     {(newEventPointSystems[event] || newPointSystem).map((p, i) => (
                                       <div key={i} className="space-y-1">
                                         <Label className="text-[10px] uppercase font-bold text-neutral-400">R{i + 1}</Label>
                                         <Input
                                           value={p}
                                           type="number"
                                           className="h-7 text-[10px] p-1 font-medium"
                                           onChange={(e) => {
                                             const val = parseInt(e.target.value) || 0;
                                             const curr = [...(newEventPointSystems[event] || newPointSystem)];
                                             curr[i] = val;
                                             setNewEventPointSystems(prev => ({ ...prev, [event]: curr }));
                                           }}
                                         />
                                       </div>
                                     ))}
                                   </div>
                                   <Button
                                     variant="destructive"
                                     size="sm"
                                     className="w-full mt-4 h-7 text-[9px] uppercase font-black"
                                     onClick={() => {
                                       const next = { ...newEventPointSystems };
                                       delete next[event];
                                       setNewEventPointSystems(next);
                                     }}
                                   >
                                     Reset to Default
                                   </Button>
                                </PopoverContent>
                              </Popover>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-dashed">
              <div>
                <Label className="text-xs uppercase tracking-widest font-black opacity-40">Point System Configuration</Label>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {newPointSystem.map((points, idx) => (
                    <div key={idx} className="space-y-1">
                      <Label htmlFor={`points-${idx}`} className="text-[10px] uppercase font-bold text-neutral-400">
                        Rank {idx + 1}
                      </Label>
                      <Input
                        id={`points-${idx}`}
                        type="number"
                        className="h-8 text-xs font-medium p-2"
                        value={points}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          const next = [...newPointSystem];
                          next[idx] = val;
                          setNewPointSystem(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={handleCreate} disabled={isCreating || !newMeetName} className="w-full h-12 text-sm font-black uppercase tracking-widest bg-black text-white hover:bg-neutral-800 transition-all rounded-none shadow-[4px_4px_0px_black] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]">
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
            <div className="space-y-4">
              <div className="rounded-md border bg-neutral-50/50">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Events Included ({editEvents.length})</TableHead>
                      <TableHead className="w-12 text-center text-[10px] font-black uppercase tracking-widest h-10 px-0">Men</TableHead>
                      <TableHead className="w-12 text-center text-[10px] font-black uppercase tracking-widest h-10 px-0">Women</TableHead>
                      <TableHead className="w-12 text-center text-[10px] font-black uppercase tracking-widest h-10 px-0">Pts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="max-h-60 overflow-y-auto">
                    {SWIM_EVENTS.map(event => {
                      const mEvent = `M:${event}`;
                      const wEvent = `W:${event}`;
                      const mChecked = editEvents.includes(mEvent);
                      const wChecked = editEvents.includes(wEvent);

                      return (
                        <TableRow key={event} className="group hover:bg-white border-b-0">
                          <TableCell className="py-2 font-medium text-sm text-neutral-700">{event}</TableCell>
                          
                          <TableCell className="w-12 py-2 px-0 text-center">
                            <Checkbox
                              id={`edit-event-m-${event}`}
                              checked={mChecked}
                              onCheckedChange={() => toggleEditEvent('M', event)}
                              className="h-4 w-4 border-slate-300 mx-auto"
                            />
                          </TableCell>
                          
                          <TableCell className="w-12 py-2 px-0 text-center">
                            <Checkbox
                              id={`edit-event-w-${event}`}
                              checked={wChecked}
                              onCheckedChange={() => toggleEditEvent('W', event)}
                              className="h-4 w-4 border-slate-300 mx-auto"
                            />
                          </TableCell>

                          <TableCell className="w-12 py-2 px-0 text-center">
                            {(mChecked || wChecked) && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100 transition-opacity p-0 mx-auto">
                                    <Settings2 className="h-3.5 w-3.5" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-4" side="left">
                                   <h4 className="font-black text-xs uppercase mb-1 text-neutral-400">Override Points</h4>
                                   <p className="text-[10px] text-muted-foreground mb-4 uppercase tracking-tighter">Event: {event}</p>
                                   <div className="grid grid-cols-4 gap-2">
                                     {(newEventPointSystems[event] || newPointSystem).map((p, i) => (
                                       <div key={i} className="space-y-1">
                                         <Label className="text-[10px] uppercase font-bold text-neutral-400">R{i + 1}</Label>
                                         <Input
                                           value={p}
                                           type="number"
                                           className="h-7 text-[10px] p-1 font-medium"
                                           onChange={(e) => {
                                             const val = parseInt(e.target.value) || 0;
                                             const curr = [...(editEventPointSystems[event] || editPointSystem)];
                                             curr[i] = val;
                                             setNewEventPointSystems(prev => ({ ...prev, [event]: curr }));
                                           }}
                                         />
                                       </div>
                                     ))}
                                   </div>
                                   <Button
                                     variant="destructive"
                                     size="sm"
                                     className="w-full mt-4 h-7 text-[9px] uppercase font-black"
                                     onClick={() => {
                                       const next = { ...newEventPointSystems };
                                       delete next[event];
                                       setNewEventPointSystems(next);
                                     }}
                                   >
                                     Reset to Default
                                   </Button>
                                </PopoverContent>
                              </Popover>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-dashed">
              <div>
                <Label className="text-xs uppercase tracking-widest font-black opacity-40">Point System Configuration</Label>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {editPointSystem.map((points, idx) => (
                    <div key={idx} className="space-y-1">
                      <Label htmlFor={`edit-global-points-${idx}`} className="text-[10px] uppercase font-bold text-neutral-400">
                        Rank {idx + 1}
                      </Label>
                      <Input
                        id={`edit-global-points-${idx}`}
                        type="number"
                        className="h-8 text-xs font-medium p-2"
                        value={points}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          const next = [...editPointSystem];
                          next[idx] = val;
                          setEditPointSystem(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
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

