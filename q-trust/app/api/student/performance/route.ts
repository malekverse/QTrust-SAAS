import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import Student from "@/models/Student"
import Grade from "@/models/Grade"
import TeacherFeedback from "@/models/TeacherFeedback"
import SessionTemplate from "@/models/SessionTemplate"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

// Force model registration
void Student; void User; void Grade; void TeacherFeedback; void SessionTemplate

// GET /api/student/performance - Get student performance data
export async function GET() {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    await dbConnect()

    const user = await User.findOne({ _id: session.user.id, tenantId }).lean()
    if (!user?.studentId) {
      return NextResponse.json({ message: "حساب الطالب غير موجود" }, { status: 404 })
    }

    const studentId = user.studentId

    // Get all grades
    const grades = await Grade.find({ tenantId, studentId })
      .populate("teacherId", "fullName")
      .populate("sessionTemplateId", "name")
      .sort({ date: -1 })
      .lean()

    // Get teacher feedback
    const feedback = await TeacherFeedback.find({ tenantId, studentId })
      .populate("teacherId", "fullName")
      .sort({ date: -1 })
      .limit(20)
      .lean()

    // Calculate averages by type
    const typeAverages: Record<string, { total: number; count: number; avg: number }> = {}
    grades.forEach(g => {
      if (!typeAverages[g.type]) {
        typeAverages[g.type] = { total: 0, count: 0, avg: 0 }
      }
      typeAverages[g.type].total += (g.score / g.maxScore) * 100
      typeAverages[g.type].count++
    })
    Object.keys(typeAverages).forEach(key => {
      typeAverages[key].avg = Math.round(typeAverages[key].total / typeAverages[key].count)
    })

    // Overall average
    let overallAverage = 0
    if (grades.length > 0) {
      const totalPercentage = grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 100, 0)
      overallAverage = Math.round(totalPercentage / grades.length)
    }

    // Progress milestones (completed Juz and Surah based on high grades)
    const completedJuz = new Set<number>()
    const completedSurahs = new Set<string>()
    grades.forEach(g => {
      const percentage = (g.score / g.maxScore) * 100
      if (percentage >= 70) {
        if (g.juz) completedJuz.add(g.juz)
        if (g.surah) completedSurahs.add(g.surah)
      }
    })

    // Badges
    const badges: { title: string; description: string; achieved: boolean; icon: string }[] = []
    
    // Juz-based badges
    if (completedJuz.size >= 1) badges.push({ title: 'بداية الطريق', description: 'إتمام الجزء الأول', achieved: true, icon: 'star' })
    if (completedJuz.size >= 5) badges.push({ title: 'المثابر', description: 'إتمام 5 أجزاء', achieved: true, icon: 'trophy' })
    if (completedJuz.size >= 10) badges.push({ title: 'الحافظ المتميز', description: 'إتمام 10 أجزاء', achieved: true, icon: 'award' })
    if (completedJuz.size >= 20) badges.push({ title: 'نصف القرآن', description: 'إتمام 20 جزءاً', achieved: true, icon: 'crown' })
    if (completedJuz.size >= 30) badges.push({ title: 'ختم القرآن', description: 'إتمام حفظ القرآن كاملاً', achieved: true, icon: 'sparkle' })
    
    // Performance badges
    if (overallAverage >= 90) badges.push({ title: 'امتياز', description: 'معدل عام فوق 90%', achieved: true, icon: 'medal' })
    if (grades.length >= 10) badges.push({ title: 'المجتهد', description: 'إكمال 10 تقييمات', achieved: true, icon: 'book' })

    // Add some aspirational badges if not yet achieved
    if (completedJuz.size < 1) badges.push({ title: 'بداية الطريق', description: 'إتمام الجزء الأول', achieved: false, icon: 'star' })
    if (completedJuz.size < 5) badges.push({ title: 'المثابر', description: 'إتمام 5 أجزاء', achieved: false, icon: 'trophy' })
    if (completedJuz.size < 10) badges.push({ title: 'الحافظ المتميز', description: 'إتمام 10 أجزاء', achieved: false, icon: 'award' })

    return NextResponse.json({
      grades: grades.map(g => ({
        _id: g._id,
        type: g.type,
        title: g.title,
        score: g.score,
        maxScore: g.maxScore,
        percentage: Math.round((g.score / g.maxScore) * 100),
        date: g.date,
        teacher: (g.teacherId as any)?.fullName || '',
        session: (g.sessionTemplateId as any)?.name || '',
        notes: g.notes,
        surah: g.surah,
        juz: g.juz,
        fromVerse: g.fromVerse,
        toVerse: g.toVerse
      })),
      feedback: feedback.map(f => ({
        _id: f._id,
        content: f.content,
        isPositive: f.isPositive,
        date: f.date,
        teacher: (f.teacherId as any)?.fullName || ''
      })),
      stats: {
        overallAverage,
        totalGrades: grades.length,
        typeAverages,
        completedJuz: completedJuz.size,
        completedSurahs: completedSurahs.size,
        totalJuz: 30
      },
      badges
    })
  } catch (error) {
    console.error("Error fetching student performance:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}
