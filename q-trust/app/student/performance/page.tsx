"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart3,
  Star,
  Trophy,
  Award,
  Crown,
  Sparkles,
  Medal,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Clock,
  GraduationCap,
} from "lucide-react"
import { GRADE_TYPE_LABELS } from "@/lib/constants"

interface GradeData {
  _id: string
  type: string
  title: string
  score: number
  maxScore: number
  percentage: number
  date: string
  teacher: string
  session: string
  notes?: string
  surah?: string
  juz?: number
  fromVerse?: number
  toVerse?: number
}

interface FeedbackData {
  _id: string
  content: string
  isPositive: boolean
  date: string
  teacher: string
}

interface BadgeData {
  title: string
  description: string
  achieved: boolean
  icon: string
}

interface PerformanceStats {
  overallAverage: number
  totalGrades: number
  typeAverages: Record<string, { total: number; count: number; avg: number }>
  completedJuz: number
  completedSurahs: number
  totalJuz: number
}

const badgeIconMap: Record<string, React.ReactNode> = {
  star: <Star className="h-6 w-6" />,
  trophy: <Trophy className="h-6 w-6" />,
  award: <Award className="h-6 w-6" />,
  crown: <Crown className="h-6 w-6" />,
  sparkle: <Sparkles className="h-6 w-6" />,
  medal: <Medal className="h-6 w-6" />,
  book: <BookOpen className="h-6 w-6" />
}

export default function StudentPerformance() {
  const [grades, setGrades] = useState<GradeData[]>([])
  const [feedback, setFeedback] = useState<FeedbackData[]>([])
  const [badges, setBadges] = useState<BadgeData[]>([])
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("grades")

  useEffect(() => {
    fetchPerformance()
  }, [])

  const fetchPerformance = async () => {
    setError(null)
    try {
      const res = await fetch("/api/student/performance")
      if (res.ok) {
        const data = await res.json()
        setGrades(data.grades)
        setFeedback(data.feedback)
        setBadges(data.badges)
        setStats(data.stats)
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-TN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getGradeColor = (percentage: number) => {
    if (percentage >= 80) return 'text-emerald-600 dark:text-emerald-400'
    if (percentage >= 60) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getGradeBg = (percentage: number) => {
    if (percentage >= 80) return 'bg-emerald-500/10'
    if (percentage >= 60) return 'bg-amber-500/10'
    return 'bg-red-500/10'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => { setLoading(true); fetchPerformance() }}>
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
          <BarChart3 className="h-7 w-7 text-primary" />
          النتائج والتقييم
        </h1>
        <p className="text-muted-foreground mt-1">متابعة أدائك وتقدمك في الحفظ</p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="card-lift">
            <CardContent className="p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 mb-2">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold">{stats.overallAverage}%</p>
              <p className="text-xs text-muted-foreground">المعدل العام</p>
            </CardContent>
          </Card>
          <Card className="card-lift">
            <CardContent className="p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 mb-2">
                <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-2xl font-bold">{stats.completedJuz}</p>
              <p className="text-xs text-muted-foreground">جزء مكتمل</p>
            </CardContent>
          </Card>
          <Card className="card-lift">
            <CardContent className="p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 mb-2">
                <GraduationCap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-2xl font-bold">{stats.totalGrades}</p>
              <p className="text-xs text-muted-foreground">تقييم</p>
            </CardContent>
          </Card>
          <Card className="card-lift">
            <CardContent className="p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 mb-2">
                <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-2xl font-bold">{badges.filter(b => b.achieved).length}</p>
              <p className="text-xs text-muted-foreground">شارة مكتسبة</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Memorization Progress Bar */}
      {stats && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">تقدم الحفظ</h3>
              <span className="text-sm text-muted-foreground">{stats.completedJuz} / {stats.totalJuz} جزء</span>
            </div>
            <div className="h-4 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-l from-primary to-emerald-500 transition-all duration-1000 relative"
                style={{ width: `${(stats.completedJuz / stats.totalJuz) * 100}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {Math.round((stats.completedJuz / stats.totalJuz) * 100)}% من القرآن الكريم
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="grades">التقييمات</TabsTrigger>
          <TabsTrigger value="feedback">ملاحظات المعلم</TabsTrigger>
          <TabsTrigger value="badges">الشارات</TabsTrigger>
        </TabsList>

        {/* Grades Tab */}
        <TabsContent value="grades" className="mt-4 space-y-3">
          {grades.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">لا توجد تقييمات بعد</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {grades.map((grade) => (
                <Card key={grade._id} className="overflow-hidden transition-all hover:shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`rounded-xl p-3 ${getGradeBg(grade.percentage)}`}>
                        <span className={`text-xl font-bold ${getGradeColor(grade.percentage)}`}>
                          {grade.percentage}%
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{grade.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {GRADE_TYPE_LABELS[grade.type] || grade.type}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDate(grade.date)}</span>
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            {grade.teacher}
                          </span>
                          {grade.surah && <span>سورة {grade.surah}</span>}
                          {grade.juz && <span>الجزء {grade.juz}</span>}
                        </div>
                        {grade.notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic bg-muted/40 rounded-md px-2 py-1">
                            {grade.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-left shrink-0">
                        <p className="text-sm font-semibold">{grade.score}/{grade.maxScore}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="mt-4 space-y-3">
          {feedback.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ThumbsUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">لا توجد ملاحظات بعد</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {feedback.map((fb) => (
                <Card key={fb._id} className="overflow-hidden transition-all hover:shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-full p-2 mt-0.5 ${
                        fb.isPositive 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                          : 'bg-amber-100 dark:bg-amber-900/30'
                      }`}>
                        {fb.isPositive 
                          ? <ThumbsUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          : <ThumbsDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-relaxed">{fb.content}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            {fb.teacher}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(fb.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Badges Tab */}
        <TabsContent value="badges" className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {badges.map((badge, index) => (
              <Card 
                key={index} 
                className={`overflow-hidden transition-all ${
                  badge.achieved 
                    ? 'card-lift border-amber-200 dark:border-amber-800' 
                    : 'opacity-50 grayscale'
                }`}
              >
                <CardContent className="p-4 text-center">
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 ${
                    badge.achieved 
                      ? 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/40 text-amber-600 dark:text-amber-400' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {badgeIconMap[badge.icon] || <Star className="h-6 w-6" />}
                  </div>
                  <h4 className="font-semibold text-sm">{badge.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                  {badge.achieved && (
                    <Badge className="mt-2 bg-amber-500 text-white text-xs">مكتسبة</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {badges.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">ابدأ رحلتك لاكتساب الشارات</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
