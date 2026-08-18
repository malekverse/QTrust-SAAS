"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Star,
  Plus,
  BookOpen,
  MessageSquare,
  Loader2,
  GraduationCap,
  ThumbsUp,
  ThumbsDown,
  Search,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"

interface StudentOption {
  _id: string
  firstName: string
  lastName: string
  fullName?: string
}

interface GradeData {
  _id: string
  studentId: { firstName: string; lastName: string; fullName?: string; _id: string }
  type: string
  title: string
  score: number
  maxScore: number
  date: string
  notes?: string
  surah?: string
  juz?: number
}

interface FeedbackData {
  _id: string
  studentId: { firstName: string; lastName: string; fullName?: string; _id: string }
  content: string
  isPositive: boolean
  date: string
}

export default function TeacherEvaluations() {
  const t = useTranslations("teacher.evaluations")
  const tc = useTranslations("common")
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("grades")
  const [grades, setGrades] = useState<GradeData[]>([])
  const [feedback, setFeedback] = useState<FeedbackData[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Grade dialog
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false)
  const [gradeForm, setGradeForm] = useState({
    studentId: "",
    type: "MEMORIZATION",
    title: "",
    score: "",
    maxScore: "20",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    surah: "",
    juz: "",
  })
  const [submittingGrade, setSubmittingGrade] = useState(false)

  // Feedback dialog
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [feedbackForm, setFeedbackForm] = useState({
    studentId: "",
    content: "",
    isPositive: true,
  })
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [gradesRes, feedbackRes, studentsRes] = await Promise.all([
        fetch("/api/teachers/grades"),
        fetch("/api/teachers/feedback"),
        fetch("/api/students?limit=200"),
      ])

      if (gradesRes.ok) setGrades(await gradesRes.json())
      if (feedbackRes.ok) setFeedback(await feedbackRes.json())
      if (studentsRes.ok) {
        const allStudents = (await studentsRes.json()).data
        setStudents(allStudents.filter((s: any) => s.isActive))
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const submitGrade = async () => {
    if (!gradeForm.studentId || !gradeForm.title || !gradeForm.score || !gradeForm.maxScore) {
      toast({ title: tc("error"), description: tc("required"), variant: "destructive" })
      return
    }

    setSubmittingGrade(true)
    try {
      const res = await fetch("/api/teachers/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: gradeForm.studentId,
          type: gradeForm.type,
          title: gradeForm.title,
          score: parseFloat(gradeForm.score),
          maxScore: parseFloat(gradeForm.maxScore),
          date: gradeForm.date,
          notes: gradeForm.notes || undefined,
          surah: gradeForm.surah || undefined,
          juz: gradeForm.juz ? parseInt(gradeForm.juz) : undefined,
        }),
      })

      if (res.ok) {
        toast({ title: tc("success"), description: t("evaluationSaved") })
        setGradeDialogOpen(false)
        setGradeForm({
          studentId: "",
          type: "MEMORIZATION",
          title: "",
          score: "",
          maxScore: "20",
          date: new Date().toISOString().split("T")[0],
          notes: "",
          surah: "",
          juz: "",
        })
        fetchData()
      } else {
        const data = await res.json()
        toast({ title: tc("error"), description: data.message, variant: "destructive" })
      }
    } catch {
      toast({ title: tc("error"), description: tc("serverError"), variant: "destructive" })
    } finally {
      setSubmittingGrade(false)
    }
  }

  const submitFeedback = async () => {
    if (!feedbackForm.studentId || !feedbackForm.content) {
      toast({ title: tc("error"), description: tc("required"), variant: "destructive" })
      return
    }

    setSubmittingFeedback(true)
    try {
      const res = await fetch("/api/teachers/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackForm),
      })

      if (res.ok) {
        toast({ title: tc("success"), description: t("evaluationSaved") })
        setFeedbackDialogOpen(false)
        setFeedbackForm({ studentId: "", content: "", isPositive: true })
        fetchData()
      } else {
        const data = await res.json()
        toast({ title: tc("error"), description: data.message, variant: "destructive" })
      }
    } catch {
      toast({ title: tc("error"), description: tc("serverError"), variant: "destructive" })
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const getStudentName = (student: { firstName?: string; lastName?: string; fullName?: string }) => {
    if (student.firstName && student.lastName) return `${student.firstName} ${student.lastName}`
    return student.fullName || ""
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ar-TN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const filteredGrades = searchQuery
    ? grades.filter((g) => {
        const name = getStudentName(g.studentId)
        return name.includes(searchQuery) || g.title.includes(searchQuery)
      })
    : grades

  const filteredFeedback = searchQuery
    ? feedback.filter((f) => {
        const name = getStudentName(f.studentId)
        return name.includes(searchQuery) || f.content.includes(searchQuery)
      })
    : feedback

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Star className="h-7 w-7 text-primary" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setGradeDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("saveEvaluation")}
          </Button>
          <Button variant="outline" onClick={() => setFeedbackDialogOpen(true)} className="gap-2">
            <MessageSquare className="h-4 w-4" />
            {t("feedback")}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={tc("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="grades">{t("grade")} ({grades.length})</TabsTrigger>
          <TabsTrigger value="feedback">{t("feedback")} ({feedback.length})</TabsTrigger>
        </TabsList>

        {/* Grades Tab */}
        <TabsContent value="grades" className="mt-4 space-y-3">
          {filteredGrades.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Star className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">{t("noEvaluations")}</p>
              </CardContent>
            </Card>
          ) : (
            filteredGrades.map((grade) => {
              const pct = Math.round((grade.score / grade.maxScore) * 100)
              return (
                <Card key={grade._id} className="transition-all hover:shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`rounded-xl p-3 ${
                          pct >= 80
                            ? "bg-emerald-500/10"
                            : pct >= 60
                              ? "bg-amber-500/10"
                              : "bg-red-500/10"
                        }`}
                      >
                        <span
                          className={`text-lg font-bold ${
                            pct >= 80
                              ? "text-emerald-600 dark:text-emerald-400"
                              : pct >= 60
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{grade.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {tc(`gradeTypes.${grade.type}`)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <GraduationCap className="h-3 w-3" />
                            {getStudentName(grade.studentId)}
                          </span>
                          <span>{formatDate(grade.date)}</span>
                          <span>
                            {grade.score}/{grade.maxScore}
                          </span>
                          {grade.surah && <span>{t("surah")} {grade.surah}</span>}
                          {grade.juz && <span>{t("juz")} {grade.juz}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="mt-4 space-y-3">
          {filteredFeedback.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">{tc("noResults")}</p>
              </CardContent>
            </Card>
          ) : (
            filteredFeedback.map((fb) => (
              <Card key={fb._id} className="transition-all hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-full p-2 mt-0.5 ${
                        fb.isPositive
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : "bg-amber-100 dark:bg-amber-900/30"
                      }`}
                    >
                      {fb.isPositive ? (
                        <ThumbsUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ThumbsDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground mb-1">
                        {getStudentName(fb.studentId)}
                      </p>
                      <p className="text-sm text-muted-foreground">{fb.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(fb.date)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Add Grade Dialog */}
      <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("saveEvaluation")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{tc("student")} *</Label>
              <Select value={gradeForm.studentId} onValueChange={(v) => setGradeForm({ ...gradeForm, studentId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectStudent")} />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.firstName} {s.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("grade")} *</Label>
              <Select value={gradeForm.type} onValueChange={(v) => setGradeForm({ ...gradeForm, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['EXAM', 'MONTHLY_EVALUATION', 'ORAL_TEST', 'MEMORIZATION', 'TAJWEED'] as const).map((key) => (
                    <SelectItem key={key} value={key}>
                      {tc(`gradeTypes.${key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("evaluationTitle")} *</Label>
              <Input
                value={gradeForm.title}
                onChange={(e) => setGradeForm({ ...gradeForm, title: e.target.value })}
                placeholder={t("evaluationTitlePlaceholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("score")} *</Label>
                <Input
                  type="number"
                  value={gradeForm.score}
                  onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })}
                  placeholder="15"
                  min="0"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("maxScore")} *</Label>
                <Input
                  type="number"
                  value={gradeForm.maxScore}
                  onChange={(e) => setGradeForm({ ...gradeForm, maxScore: e.target.value })}
                  placeholder="20"
                  min="1"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tc("date")} *</Label>
              <Input
                type="date"
                value={gradeForm.date}
                onChange={(e) => setGradeForm({ ...gradeForm, date: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("surah")}</Label>
                <Input
                  value={gradeForm.surah}
                  onChange={(e) => setGradeForm({ ...gradeForm, surah: e.target.value })}
                  placeholder={t("surahPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("juz")}</Label>
                <Input
                  type="number"
                  value={gradeForm.juz}
                  onChange={(e) => setGradeForm({ ...gradeForm, juz: e.target.value })}
                  placeholder="1-30"
                  min="1"
                  max="30"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tc("notes")}</Label>
              <Textarea
                value={gradeForm.notes}
                onChange={(e) => setGradeForm({ ...gradeForm, notes: e.target.value })}
                placeholder={t("notesPlaceholder")}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={submitGrade} disabled={submittingGrade}>
              {submittingGrade ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  {tc("saving")}
                </>
              ) : (
                t("saveEvaluation")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("feedback")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{tc("student")} *</Label>
              <Select
                value={feedbackForm.studentId}
                onValueChange={(v) => setFeedbackForm({ ...feedbackForm, studentId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectStudent")} />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.firstName} {s.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("feedbackType")}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={feedbackForm.isPositive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFeedbackForm({ ...feedbackForm, isPositive: true })}
                  className="gap-1"
                >
                  <ThumbsUp className="h-4 w-4" />
                  {t("positive")}
                </Button>
                <Button
                  type="button"
                  variant={!feedbackForm.isPositive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFeedbackForm({ ...feedbackForm, isPositive: false })}
                  className="gap-1"
                >
                  <ThumbsDown className="h-4 w-4" />
                  {t("improvement")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("contentLabel")} *</Label>
              <Textarea
                value={feedbackForm.content}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, content: e.target.value })}
                placeholder={t("feedbackPlaceholder")}
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">{feedbackForm.content.length}/1000</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={submitFeedback} disabled={submittingFeedback}>
              {submittingFeedback ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  {tc("saving")}
                </>
              ) : (
                tc("save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
