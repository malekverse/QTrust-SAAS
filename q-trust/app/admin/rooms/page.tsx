"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Pagination } from "@/components/ui/pagination"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { roomFormSchema, type RoomFormInput } from "@/lib/validations"
import { ROOM_FEATURES } from "@/lib/constants"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/layout/stat-card"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DoorOpen,
  Plus,
  Search,
  Users,
  MapPin,
  Pencil,
  Trash2,
  BarChart3,
} from "lucide-react"
import Link from "next/link"

async function fetchRooms(page: number) {
  const res = await fetch(`/api/rooms?page=${page}`)
  if (!res.ok) throw new Error("Failed to fetch rooms")
  return res.json()
}

async function createRoom(data: RoomFormInput) {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.message || "Failed to create room")
  }
  return res.json()
}

async function updateRoom(id: string, data: Partial<RoomFormInput>) {
  const res = await fetch(`/api/rooms/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.message || "Failed to update room")
  }
  return res.json()
}

async function deleteRoom(id: string) {
  const res = await fetch(`/api/rooms/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.message || "Failed to delete room")
  }
  return res.json()
}

export default function RoomsPage() {
  const queryClient = useQueryClient()
  const { success, error: showError } = useToast()
  const [search, setSearch] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const t = useTranslations("admin.rooms")
  const tc = useTranslations("common")

  const { data: roomsResponse, isLoading } = useQuery({
    queryKey: ["rooms", page],
    queryFn: () => fetchRooms(page),
  })
  const rooms = roomsResponse?.data ?? []
  const roomsPagination = roomsResponse?.pagination

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<RoomFormInput>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: { features: [] },
  })

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    control: controlEdit,
    setValue: setEditValue,
    formState: { errors: editErrors },
  } = useForm<RoomFormInput>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: { features: [] },
  })

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] })
      setIsCreateOpen(false)
      reset()
      success(t("created"), t("roomCreated", { name: data.name }))
    },
    onError: () => showError(tc("error"), t("createRoomError")),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RoomFormInput> }) =>
      updateRoom(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] })
      setEditingRoom(null)
      success(t("updated"), t("roomUpdated"))
    },
    onError: () => showError(tc("error"), t("updateRoomError")),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] })
      setDeleteId(null)
      success(t("deleted"), t("roomDeleted"))
    },
    onError: () => {
      setDeleteId(null)
      showError(tc("error"), t("deleteRoomError"))
    },
  })

  const openEdit = (room: any) => {
    setEditingRoom(room)
    setEditValue("name", room.name)
    setEditValue("capacity", room.capacity)
    setEditValue("description", room.description || "")
    setEditValue("location", room.location || "")
    setEditValue("features", room.features || [])
  }

  const filteredRooms = rooms.filter((room: any) =>
    room.name.toLowerCase().includes(search.toLowerCase()) ||
    room.location?.toLowerCase().includes(search.toLowerCase())
  )

  const activeRooms = rooms.filter((r: any) => r.isActive)
  const totalCapacity = activeRooms.reduce((s: number, r: any) => s + r.capacity, 0)
  const usedRooms = activeRooms.filter((r: any) => r.sessionCount > 0)

  const featureKeys = Object.keys(ROOM_FEATURES) as (keyof typeof ROOM_FEATURES)[]

  function FeaturesCheckboxGroup({ control: ctrl, name }: { control: any; name: string }) {
    return (
      <Controller
        control={ctrl}
        name={name}
        render={({ field }) => (
          <div className="grid grid-cols-2 gap-2">
            {featureKeys.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={(field.value || []).includes(ROOM_FEATURES[key])}
                  onCheckedChange={(checked) => {
                    const current = field.value || []
                    field.onChange(
                      checked
                        ? [...current, ROOM_FEATURES[key]]
                        : current.filter((f: string) => f !== ROOM_FEATURES[key])
                    )
                  }}
                />
                {t('featureLabels.' + ROOM_FEATURES[key])}
              </label>
            ))}
          </div>
        )}
      />
    )
  }

  function RoomFormFields({ onSubmit, reg, errs, ctrl, loading }: {
    onSubmit: React.FormEventHandler<HTMLFormElement>
    reg: ReturnType<typeof useForm<RoomFormInput>>["register"]
    errs: ReturnType<typeof useForm<RoomFormInput>>["formState"]["errors"]
    ctrl: ReturnType<typeof useForm<RoomFormInput>>["control"]
    loading: boolean
  }) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">{t("roomName")} *</label>
          <Input {...reg("name")} placeholder={t("roomNamePlaceholder")} />
          {errs.name && <p className="text-sm text-destructive mt-1">{errs.name.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">{t("capacity")} *</label>
          <Input type="number" {...reg("capacity", { valueAsNumber: true })} placeholder="20" />
          {errs.capacity && <p className="text-sm text-destructive mt-1">{errs.capacity.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">{t("location")}</label>
          <Input {...reg("location")} placeholder={t("locationPlaceholder")} />
        </div>
        <div>
          <label className="text-sm font-medium">{tc("description")}</label>
          <Input {...reg("description")} placeholder={t("descriptionPlaceholder")} />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">{t("features")}</label>
          <FeaturesCheckboxGroup control={ctrl} name="features" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? tc("loading") : tc("save")}
        </Button>
      </form>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 space-y-4">
                <div className="h-6 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              {t("addRoom")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("addRoom")}</DialogTitle>
            </DialogHeader>
            <RoomFormFields
              onSubmit={handleSubmit((data) => createMutation.mutate(data))}
              reg={register}
              errs={errors}
              ctrl={control}
              loading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("totalRooms")} value={activeRooms.length} icon={DoorOpen} index={0} />
        <StatCard title={t("usedRooms")} value={usedRooms.length} icon={BarChart3} index={1} />
        <StatCard title={t("capacity")} value={totalCapacity} icon={Users} index={2} />
        <StatCard
          title={t("utilizationRate")}
          value={`${activeRooms.length > 0 ? Math.round((usedRooms.length / activeRooms.length) * 100) : 0}%`}
          icon={MapPin}
          index={3}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("searchRoom")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Room Cards */}
      {filteredRooms.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <DoorOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">{t("noRooms")}</h3>
            <p className="text-muted-foreground">{t("startAddingRooms")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map((room: any) => {
            const utilPercent = room.capacity > 0
              ? Math.round((room.maxOccupancy / room.capacity) * 100)
              : 0
            const barColor =
              utilPercent > 100 ? "bg-destructive" :
              utilPercent >= 80 ? "bg-amber-500" :
              "bg-emerald-500"

            return (
              <Card key={room._id} className={`card-lift ${!room.isActive ? "opacity-60" : ""}`}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link href={`/admin/rooms/${room._id}`} className="font-semibold text-lg hover:underline">
                        {room.name}
                      </Link>
                      {room.location && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {room.location}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(room)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(room._id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{t("capacity")}</span>
                      <span className="font-medium">
                        {room.maxOccupancy}/{room.capacity}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.min(utilPercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Session count */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("activeSessions")}</span>
                    <Badge variant="secondary">{room.sessionCount}</Badge>
                  </div>

                  {/* Features */}
                  {room.features?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {room.features.map((f: string) => (
                        <Badge key={f} variant="outline" className="text-xs">
                          {t('featureLabels.' + f)}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {!room.isActive && <Badge variant="destructive">{t("disabledStatus")}</Badge>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {roomsPagination && (
        <Pagination page={roomsPagination.page} pages={roomsPagination.pages} total={roomsPagination.total} onPageChange={setPage} />
      )}

      {/* Edit Dialog */}
      {editingRoom && (
        <Dialog open={!!editingRoom} onOpenChange={() => setEditingRoom(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("editRoom")}</DialogTitle>
            </DialogHeader>
            <RoomFormFields
              onSubmit={handleEditSubmit((data) =>
                updateMutation.mutate({ id: editingRoom._id, data })
              )}
              reg={registerEdit}
              errs={editErrors}
              ctrl={controlEdit}
              loading={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc("deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
