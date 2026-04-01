"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Facebook, ImageIcon, Plus, Loader2, CalendarIcon, Delete, Edit } from "lucide-react"
import Link from "next/link"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Id } from "@/convex/_generated/dataModel"

const COVER_COLORS = [
  "bg-blue-100 dark:bg-blue-900/20",
  "bg-emerald-100 dark:bg-emerald-900/20",
  "bg-amber-100 dark:bg-amber-900/20",
  "bg-purple-100 dark:bg-purple-900/20",
  "bg-rose-100 dark:bg-rose-900/20",
  "bg-cyan-100 dark:bg-cyan-900/20",
]

interface AlbumData {
  title: string;
  description: string;
  link: string;
  date: string;
  coverImage?: string;
}

interface AlbumDialogProps {
  mode?: "create" | "edit";
  initialData?: AlbumData;
  trigger?: React.ReactNode;
  onSubmit: (data: AlbumData) => Promise<any>;
}

const AlbumDialog = ({ mode = "create", initialData, trigger, onSubmit }: AlbumDialogProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    link: "",
    coverImage: "",
    date: "",
  })
  const [newAlbumDate, setNewAlbumDate] = useState<Date | undefined>(new Date())

  // Reset or populate form when dialog opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          title: initialData.title,
          description: initialData.description,
          link: initialData.link,
          coverImage: initialData.coverImage || "",
          date: initialData.date,
        })
        setNewAlbumDate(initialData.date ? new Date(initialData.date) : new Date())
      } else {
        setFormData({ title: "", description: "", link: "", coverImage: "", date: "" })
        setNewAlbumDate(new Date())
      }
    }
  }, [isOpen, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.link) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: formData.title,
        link: formData.link,
        description: formData.description,
        date: newAlbumDate ? newAlbumDate.toISOString() : new Date().toISOString(),
        coverImage: formData.coverImage || "",
      })
      setIsOpen(false)
    } catch (error) {
      console.error("Failed to save album:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add New Album" : "Edit Album"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Fill in the details to create a new album."
              : "Update the album details below."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link">Link</Label>
            <Input
              id="link"
              name="link"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverImage">Cover Image URL</Label>
            <Input
              id="coverImage"
              name="coverImage"
              value={formData.coverImage}
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !newAlbumDate && "text-muted-foreground"
                  )}
                >
                  {newAlbumDate ? format(newAlbumDate, "PPP") : <span>Pick a date</span>}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={newAlbumDate}
                  onSelect={setNewAlbumDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : mode === "create" ? "Create Album" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function GalleryPage() {
  const albums = useQuery(api.albums.get)
  const createAlbum = useAction(api.albums.create)
  const updateAlbum = useAction(api.albums.update)
  const deleteAlbum = useMutation(api.albums.deleteAlbum)

  return (
    <div className="space-y-6 p-6 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Gallery</h1>
          <p className="text-muted-foreground">Photos and albums from our past swimming meets and events.</p>
        </div>

        <AlbumDialog
          mode="create"
          onSubmit={createAlbum}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Album
            </Button>
          }
        />
      </div>

      {albums === undefined ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : albums.length === 0 ? (
        <div className="text-center p-12 border rounded-lg border-dashed text-muted-foreground bg-muted/50">
          <ImageIcon className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <h3 className="text-lg font-medium">No albums yet</h3>
          <p>Click "Add Album" to start building your gallery.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album, index) => {
            const coverColor = COVER_COLORS[index % COVER_COLORS.length]
            return (
              <Card key={album._id} className="overflow-hidden flex flex-col hover:shadow-lg transition-shadow group pt-0">
                <div className={`h-48 w-full ${coverColor} flex items-center justify-center transition-colors group-hover:opacity-90 relative`}>
                  {album.coverImage ? (
                    <img src={album.coverImage} alt={album.title} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                  )}
                </div>
                <CardHeader>
                  <CardTitle className="line-clamp-1">{album.title}</CardTitle>
                  <CardDescription>
                    {album.date ? (
                      !isNaN(Date.parse(album.date)) ? format(new Date(album.date), "PPP") : album.date
                    ) : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {album.description}
                  </p>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button asChild className="w-full" variant="outline">
                    <Link href={album.link} target="_blank" rel="noopener noreferrer">
                      <Facebook className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                      View Album
                    </Link>
                  </Button>

                  <div className="flex w-full gap-2">
                    <AlbumDialog
                      mode="edit"
                      initialData={album}
                      onSubmit={async (data) => await updateAlbum({ id: album._id, ...data })}
                      trigger={
                        <Button className="flex-1" variant="outline">
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      }
                    />

                    <Button onClick={() => deleteAlbum({ id: album._id })} className="flex-1" variant="outline">
                      <Delete className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
