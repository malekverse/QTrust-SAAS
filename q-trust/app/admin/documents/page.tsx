"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Pagination } from "@/components/ui/pagination"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BookOpen,
  Plus,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  Search,
  Download,
  Loader2,
  Upload,
  Globe,
  Lock,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Link as LinkIcon,
  File,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants"

type UploadMode = "file" | "url"

interface DocumentItem {
  _id: string
  title: string
  description?: string
  category: string
  fileUrl: string
  fileType: string
  fileSize: number
  thumbnailUrl?: string
  isPublic: boolean
  downloadCount: number
  createdAt: string
  uploadedBy?: { fullName: string }
}

const MAX_FILE_SIZE_MB = 25
const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.mp3,.mp4,.ogg,.wav,.webm,.png,.jpg,.jpeg,.gif,.webp"

function getFileIcon(fileType: string) {
  if (fileType?.includes("image")) return <FileImage className="h-5 w-5 text-blue-500" />
  if (fileType?.includes("audio")) return <FileAudio className="h-5 w-5 text-purple-500" />
  if (fileType?.includes("video")) return <FileVideo className="h-5 w-5 text-red-500" />
  if (fileType?.includes("pdf")) return <FileText className="h-5 w-5 text-rose-500" />
  return <FileText className="h-5 w-5 text-amber-500" />
}

function getFileIconLarge(fileType: string) {
  if (fileType?.includes("image")) return <FileImage className="h-8 w-8 text-blue-500" />
  if (fileType?.includes("audio")) return <FileAudio className="h-8 w-8 text-purple-500" />
  if (fileType?.includes("video")) return <FileVideo className="h-8 w-8 text-red-500" />
  if (fileType?.includes("pdf")) return <FileText className="h-8 w-8 text-rose-500" />
  return <File className="h-8 w-8 text-amber-500" />
}

function formatFileSize(bytes: number) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ar-TN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function AdminDocuments() {
  const { toast } = useToast()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [paginationInfo, setPaginationInfo] = useState<{ page: number; pages: number; total: number } | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  // Upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadMode, setUploadMode] = useState<UploadMode>("file")
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    category: "GENERAL",
    fileUrl: "",
    fileType: "application/pdf",
    fileSize: 0,
    isPublic: true,
  })
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingDoc, setDeletingDoc] = useState<DocumentItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchDocuments()
  }, [categoryFilter, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDocuments = async () => {
    try {
      const params = new URLSearchParams()
      if (categoryFilter !== "all") params.set("category", categoryFilter)
      params.set("page", String(page))
      const res = await fetch(`/api/documents?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.data || [])
        if (data.pagination) setPaginationInfo(data.pagination)
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const resetUploadDialog = () => {
    setUploadForm({
      title: "",
      description: "",
      category: "GENERAL",
      fileUrl: "",
      fileType: "application/pdf",
      fileSize: 0,
      isPublic: true,
    })
    setSelectedFile(null)
    setUploadedUrl(null)
    setUploadProgress(0)
    setUploadMode("file")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleFileSelect = (file: File) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "خطأ",
        description: `حجم الملف يجب أن لا يتجاوز ${MAX_FILE_SIZE_MB} ميغابايت`,
        variant: "destructive",
      })
      return
    }

    setSelectedFile(file)
    setUploadedUrl(null)
    setUploadForm((prev) => ({
      ...prev,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      title: prev.title || file.name.replace(/\.[^.]+$/, ""),
    }))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }, [])

  const removeSelectedFile = () => {
    setSelectedFile(null)
    setUploadedUrl(null)
    setUploadProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const uploadFileToServer = async (file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("type", "document")

    setUploadProgress(0)

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressInterval)
          return prev
        }
        return prev + Math.random() * 12
      })
    }, 200)

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "فشل في رفع الملف")
      }

      setUploadProgress(100)
      const data = await res.json()
      setUploadedUrl(data.url)
      return data.url
    } catch (err) {
      clearInterval(progressInterval)
      setUploadProgress(0)
      const message = err instanceof Error ? err.message : "فشل في رفع الملف"
      toast({ title: "خطأ في الرفع", description: message, variant: "destructive" })
      return null
    }
  }

  const uploadDocument = async () => {
    if (!uploadForm.title.trim()) {
      toast({ title: "خطأ", description: "عنوان المستند مطلوب", variant: "destructive" })
      return
    }

    if (uploadMode === "file" && !selectedFile && !uploadedUrl) {
      toast({ title: "خطأ", description: "يرجى اختيار ملف للرفع", variant: "destructive" })
      return
    }

    if (uploadMode === "url" && !uploadForm.fileUrl.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال رابط الملف", variant: "destructive" })
      return
    }

    setUploading(true)
    try {
      let fileUrl = uploadMode === "url" ? uploadForm.fileUrl.trim() : uploadedUrl

      // Upload file if not already uploaded
      if (uploadMode === "file" && selectedFile && !uploadedUrl) {
        fileUrl = await uploadFileToServer(selectedFile)
        if (!fileUrl) {
          setUploading(false)
          return
        }
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: uploadForm.title.trim(),
          description: uploadForm.description.trim() || undefined,
          category: uploadForm.category,
          fileUrl,
          fileType: uploadForm.fileType,
          fileSize: uploadForm.fileSize,
          isPublic: uploadForm.isPublic,
        }),
      })

      if (res.ok) {
        toast({ title: "تم الحفظ", description: "تمت إضافة المستند بنجاح" })
        setUploadDialogOpen(false)
        resetUploadDialog()
        fetchDocuments()
      } else {
        const data = await res.json()
        toast({ title: "خطأ", description: data.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الحفظ", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteClick = (doc: DocumentItem) => {
    setDeletingDoc(doc)
    setDeleteDialogOpen(true)
  }

  const deleteDocument = async () => {
    if (!deletingDoc) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/documents/${deletingDoc._id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "تم الحذف", description: "تم حذف المستند بنجاح" })
        setDocuments((prev) => prev.filter((d) => d._id !== deletingDoc._id))
      } else {
        const data = await res.json()
        toast({ title: "خطأ", description: data.message || "فشل حذف المستند", variant: "destructive" })
      }
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الحذف", variant: "destructive" })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setDeletingDoc(null)
    }
  }

  const filteredDocuments = searchQuery
    ? documents.filter(
        (d) =>
          d.title.includes(searchQuery) || d.description?.includes(searchQuery)
      )
    : documents

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <BookOpen className="h-7 w-7 text-primary" />
            إدارة المكتبة
          </h1>
          <p className="text-muted-foreground mt-1">رفع وإدارة الوثائق والمواد التعليمية</p>
        </div>
        <Button onClick={() => { resetUploadDialog(); setUploadDialogOpen(true) }} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة مستند
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث في المستندات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); setLoading(true) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="جميع الفئات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الفئات</SelectItem>
            {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Documents List */}
      <div className="space-y-3">
        {filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">لا توجد مستندات بعد</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => { resetUploadDialog(); setUploadDialogOpen(true) }}>
                <Upload className="h-4 w-4" />
                رفع أول مستند
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredDocuments.map((doc) => (
            <Card key={doc._id} className="transition-all hover:shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-muted/50 p-3 shrink-0">
                    {getFileIcon(doc.fileType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">{doc.title}</h4>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                      </Badge>
                      {doc.isPublic ? (
                        <Globe className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-1">{doc.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {doc.fileSize > 0 && <span>{formatFileSize(doc.fileSize)}</span>}
                      <span>{formatDate(doc.createdAt)}</span>
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {doc.downloadCount} تحميل
                      </span>
                      {doc.uploadedBy && <span>رفع بواسطة: {doc.uploadedBy.fullName}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(doc.fileUrl, "_blank")}
                      title="تحميل"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteClick(doc)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {paginationInfo && (
        <Pagination page={paginationInfo.page} pages={paginationInfo.pages} total={paginationInfo.total} onPageChange={setPage} />
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => { setUploadDialogOpen(open); if (!open) resetUploadDialog() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة مستند جديد</DialogTitle>
            <DialogDescription>رفع ملف تعليمي للمكتبة</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Upload Mode Tabs */}
            <div className="flex rounded-lg border bg-muted/30 p-1 gap-1">
              <button
                type="button"
                onClick={() => setUploadMode("file")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  uploadMode === "file"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="h-4 w-4" />
                رفع ملف
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("url")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  uploadMode === "url"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LinkIcon className="h-4 w-4" />
                رابط خارجي
              </button>
            </div>

            {/* File Upload Area */}
            {uploadMode === "file" && (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={handleInputChange}
                  className="sr-only"
                  tabIndex={-1}
                />

                {!selectedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer ${
                      isDragging
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                    }`}
                  >
                    <div className={`rounded-full p-4 transition-colors ${isDragging ? "bg-primary/15" : "bg-primary/10"}`}>
                      <Upload className={`h-7 w-7 transition-colors ${isDragging ? "text-primary" : "text-primary/70"}`} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        {isDragging ? "أفلت الملف هنا" : "اسحب وأفلت الملف هنا"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        أو <span className="text-primary font-medium">اضغط لاختيار ملف</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-3">
                        PDF, Word, PowerPoint, Excel, صور, صوت, فيديو
                      </p>
                      <p className="text-xs text-muted-foreground">
                        الحد الأقصى: {MAX_FILE_SIZE_MB} ميغابايت
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-muted/50 p-2.5 shrink-0">
                        {getFileIconLarge(selectedFile.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" dir="ltr">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatFileSize(selectedFile.size)}
                        </p>
                      </div>
                      {!uploading && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={removeSelectedFile}
                          className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Upload Progress */}
                    {uploading && uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">جاري الرفع...</span>
                          <span className="text-primary font-medium">{Math.round(uploadProgress)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Upload Success */}
                    {uploadedUrl && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 rounded-lg px-3 py-2">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        <span>تم رفع الملف بنجاح</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* URL Input */}
            {uploadMode === "url" && (
              <div className="space-y-2">
                <Label>رابط الملف</Label>
                <Input
                  value={uploadForm.fileUrl}
                  onChange={(e) => setUploadForm({ ...uploadForm, fileUrl: e.target.value })}
                  placeholder="https://example.com/document.pdf"
                  dir="ltr"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  أدخل رابط مباشر للملف (Google Drive, Dropbox, أو أي رابط آخر)
                </p>
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label>عنوان المستند <span className="text-destructive">*</span></Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                placeholder="أحكام التجويد - المستوى الأول"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                placeholder="وصف مختصر للمستند..."
                rows={2}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>الفئة</Label>
              <Select
                value={uploadForm.category}
                onValueChange={(v) => setUploadForm({ ...uploadForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label>الظهور</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={uploadForm.isPublic ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUploadForm({ ...uploadForm, isPublic: true })}
                  className="gap-1.5"
                >
                  <Globe className="h-4 w-4" />
                  عام
                </Button>
                <Button
                  type="button"
                  variant={!uploadForm.isPublic ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUploadForm({ ...uploadForm, isPublic: false })}
                  className="gap-1.5"
                >
                  <Lock className="h-4 w-4" />
                  خاص
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
              إلغاء
            </Button>
            <Button onClick={uploadDocument} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Upload className="ml-2 h-4 w-4" />
                  حفظ المستند
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>حذف المستند</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف &quot;{deletingDoc?.title}&quot;؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={deleteDocument} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                <>
                  <Trash2 className="ml-2 h-4 w-4" />
                  حذف
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
