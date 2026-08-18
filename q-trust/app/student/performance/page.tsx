"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
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
  Heart,
  AlertTriangle,
} from "lucide-react"
import { BEHAVIOR_TYPE } from "@/lib/constants"

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

interface HifzLogData {
  _id: string
  type: string
  surah: string
  fromVerse: number
  toVerse: number
  quality: string
  mistakeCount?: number
  notes?: string
  date: string
  teacherId?: { fullName?: string }
}

interface BehaviorLogData {
  _id: string
  type: string
  description: string
  date: string
  teacherId?: { fullName?: string }
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
  const t = useTranslations("student.performance")
  const tc = useTranslations("common")
  const [grades, setGrades] = useState<GradeData[]>([])
  const [feedback, setFeedback] = useState<FeedbackData[]>([])
  const [badges, setBadges] = useState<BadgeData[]>([])
  const [hifzLogs, setHifzLogs] = useState<HifzLogData[]>([])
  const [behaviorLogs, setBehaviorLogs] = useState<BehaviorLogData[]>([])
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
      const [perfRes, hifzRes, behaviorRes] = await Promise.all([
        fetch("/api/student/performance"),
        fetch("/api/student/hifz?limit=100"),
        fetch("/api/student/behavior?limit=100"),
      ])
      if (perfRes.ok) {
        const data = await perfRes.json()
        setGrades(data.grades)
        setFeedback(data.feedback)
        setBadges(data.badges)
        setStats(data.stats)
      } else {
        const errData = await perfRes.json().catch(() => null)
        setError(errData?.message || t("loadError"))
      }
      if (hifzRes.ok) {
        setHifzLogs(await hifzRes.json())
      }
      if (behaviorRes.ok) {
        setBehaviorLogs(await behaviorRes.json())
      }
    } catch (err) {
      console.error("Error:", err)
      setError(t("connectionError"))
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

  const hifzQualityColor: Record<string, string> = {
    EXCELLENT: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    GOOD: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
    NEEDS_REVIEW: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    WEAK: 'bg-red-500/15 text-red-700 dark:text-red-400',
  }

  const hifzTypeColor: Record<string, string> = {
    SABAQ: 'border-primary/40 text-primary',
    SABQI: 'border-violet-500/40 text-violet-700 dark:text-violet-400',
    MANZIL: 'border-teal-500/40 text-teal-700 dark:text-teal-400',
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
          {t("retry")}
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
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("description")}</p>
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
              <p className="text-xs text-muted-foreground">{t("overallGrade")}</p>
            </CardContent>
          </Card>
          <Card className="card-lift">
            <CardContent className="p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 mb-2">
                <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-2xl font-bold">{stats.completedJuz}</p>
              <p className="text-xs text-muted-foreground">{t("completedJuz")}</p>
            </CardContent>
          </Card>
          <Card className="card-lift">
            <CardContent className="p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 mb-2">
                <GraduationCap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-2xl font-bold">{stats.totalGrades}</p>
              <p className="text-xs text-muted-foreground">{t("evaluationCount")}</p>
            </CardContent>
          </Card>
          <Card className="card-lift">
            <CardContent className="p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 mb-2">
                <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-2xl font-bold">{badges.filter(b => b.achieved).length}</p>
              <p className="text-xs text-muted-foreground">{t("earnedBadges")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Memorization Progress Bar */}
      {stats && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{t("hifzProgress")}</h3>
              <span className="text-sm text-muted-foreground">{t("juzCount", { completed: stats.completedJuz, total: stats.totalJuz })}</span>
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
              {t("quranProgress", { percent: Math.round((stats.completedJuz / stats.totalJuz) * 100) })}
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="grades">{t("gradesTab")}</TabsTrigger>
          <TabsTrigger value="hifz">{t("hifzTab")}</TabsTrigger>
          <TabsTrigger value="behavior">{t("behaviorTab")}</TabsTrigger>
          <TabsTrigger value="feedback">{t("feedbackTab")}</TabsTrigger>
          <TabsTrigger value="badges">{t("badgesTab")}</TabsTrigger>
        </TabsList>

        {/* Grades Tab */}
        <TabsContent value="grades" className="mt-4 space-y-3">
          {grades.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">{t("noResults")}</p>
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
                            {tc(`gradeTypes.${grade.type}`)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDate(grade.date)}</span>
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            {grade.teacher}
                          </span>
                          {grade.surah && <span>{t("surah", { name: grade.surah })}</span>}
                          {grade.juz && <span>{t("juz", { number: grade.juz })}</span>}
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

        {/* Hifz Tab */}
        <TabsContent value="hifz" className="mt-4 space-y-3">
          {hifzLogs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">{t("noHifzRecords")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {hifzLogs.map((log) => (
                <Card key={log._id} className="overflow-hidden transition-all hover:shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`rounded-xl p-3 ${hifzQualityColor[log.quality] || 'bg-muted'}`}>
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{t("surah", { name: log.surah })}</h4>
                          <Badge variant="outline" className={`text-xs ${hifzTypeColor[log.type] || ''}`}>
                            {tc(`hifzTypes.${log.type}`)}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${hifzQualityColor[log.quality] || ''}`}>
                            {tc(`hifzQuality.${log.quality}`)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{t("verses", { from: log.fromVerse, to: log.toVerse })}</span>
                          <span>{formatDate(log.date)}</span>
                          {log.teacherId?.fullName && (
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {log.teacherId.fullName}
                            </span>
                          )}
                          {typeof log.mistakeCount === 'number' && (
                            <span>{t("mistakes", { count: log.mistakeCount })}</span>
                          )}
                        </div>
                        {log.notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic bg-muted/40 rounded-md px-2 py-1">
                            {log.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Behavior Tab */}
        <TabsContent value="behavior" className="mt-4 space-y-3">
          {behaviorLogs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Heart className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">{t("noBehaviorRecords")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {behaviorLogs.map((log) => {
                const isPositive = log.type === BEHAVIOR_TYPE.POSITIVE
                return (
                  <Card key={log._id} className="overflow-hidden transition-all hover:shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`rounded-full p-2 mt-0.5 ${
                          isPositive
                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                            : 'bg-amber-100 dark:bg-amber-900/30'
                        }`}>
                          {isPositive
                            ? <ThumbsUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={`text-xs ${
                              isPositive
                                ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                                : 'border-amber-500/40 text-amber-700 dark:text-amber-400'
                            }`}>
                              {tc(`behaviorTypes.${log.type}`)}
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{log.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {log.teacherId?.fullName && (
                              <span className="flex items-center gap-1">
                                <GraduationCap className="h-3 w-3" />
                                {log.teacherId.fullName}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(log.date)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="mt-4 space-y-3">
          {feedback.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ThumbsUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">{t("noFeedback")}</p>
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
                    <Badge className="mt-2 bg-amber-500 text-white text-xs">{t("achieved")}</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {badges.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">{t("startBadgeJourney")}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
