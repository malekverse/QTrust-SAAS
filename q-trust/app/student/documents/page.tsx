"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  BookOpen,
  FileText,
  Download,
  Search,
  FolderOpen,
  Calendar,
  User,
  Eye,
  File,
  FileImage,
  FileIcon,
} from "lucide-react"
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants"

interface DocumentData {
  _id: string
  title: string
  description?: string
  category: string
  fileUrl: string
  fileType: string
  fileSize?: number
  thumbnailUrl?: string
  uploadedBy: string
  downloadCount: number
  createdAt: string
}

const categoryIcons: Record<string, React.ReactNode> = {
  QURAN_STUDY: <BookOpen className="h-5 w-5" />,
  TAJWEED: <FileText className="h-5 w-5" />,
  MEMORIZATION_GUIDE: <BookOpen className="h-5 w-5" />,
  EXAM_MATERIAL: <FileText className="h-5 w-5" />,
  GENERAL: <FolderOpen className="h-5 w-5" />,
  COMPETITION: <FileText className="h-5 w-5" />,
  OTHER: <File className="h-5 w-5" />
}

const categoryColors: Record<string, string> = {
  QURAN_STUDY: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  TAJWEED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  MEMORIZATION_GUIDE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  EXAM_MATERIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  GENERAL: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  COMPETITION: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  OTHER: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileType: string): React.ReactNode {
  if (fileType.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />
  if (fileType.includes('image')) return <FileImage className="h-8 w-8 text-blue-500" />
  return <FileIcon className="h-8 w-8 text-gray-500" />
}

export default function StudentDocuments() {
  const [documents, setDocuments] = useState<DocumentData[]>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchDocuments()
  }, [activeCategory])

  const fetchDocuments = async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (activeCategory !== "all") params.set("category", activeCategory)
      
      const res = await fetch(`/api/student/documents?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents)
        setCategoryCounts(data.categoryCounts)
      } else {
        const errData = await res.json().catch(() => null)
        setError(errData?.message || "حدث خطأ أثناء تحميل البيانات")
      }
    } catch (err) {
      console.error("Error:", err)
      setError("حدث خطأ في الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (doc: DocumentData) => {
    // Track download
    try {
      await fetch("/api/student/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc._id })
      })
    } catch { /* non-critical */ }

    // Open file
    window.open(doc.fileUrl, '_blank')
  }

  const filteredDocs = searchQuery
    ? documents.filter(d => 
        d.title.includes(searchQuery) || 
        d.description?.includes(searchQuery)
      )
    : documents

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-TN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => { setLoading(true); fetchDocuments() }}>
          إعادة المحاولة
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          المكتبة
        </h1>
        <p className="text-muted-foreground mt-1">المستندات والموارد التعليمية</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ابحث عن مستند..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCategory("all")}
          className="text-xs"
        >
          الكل ({Object.values(categoryCounts).reduce((a, b) => a + b, 0)})
        </Button>
        {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => {
          const count = categoryCounts[key] || 0
          if (count === 0 && activeCategory !== key) return null
          return (
            <Button
              key={key}
              variant={activeCategory === key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(key)}
              className="text-xs"
            >
              {label} ({count})
            </Button>
          )
        })}
      </div>

      {/* Documents Grid */}
      {filteredDocs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              {searchQuery ? "لا توجد نتائج للبحث" : "لا توجد مستندات متاحة حالياً"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocs.map((doc) => (
            <Card key={doc._id} className="overflow-hidden card-lift transition-all hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* File Type Icon */}
                  <div className={`rounded-xl p-3 ${categoryColors[doc.category] || categoryColors.OTHER}`}>
                    {doc.thumbnailUrl ? (
                      <Image src={doc.thumbnailUrl} alt="" width={32} height={32} className="object-cover rounded" />
                    ) : (
                      getFileIcon(doc.fileType)
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm line-clamp-1">{doc.title}</h4>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                      </Badge>
                      {doc.fileSize && (
                        <span>{formatFileSize(doc.fileSize)}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(doc.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {doc.downloadCount}
                      </span>
                    </div>
                  </div>

                  {/* Download Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    className="shrink-0 gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">تحميل</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
