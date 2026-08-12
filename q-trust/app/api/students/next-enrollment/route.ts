import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import Settings, { 
  DEFAULT_ENROLLMENT_SETTINGS, 
  generateEnrollmentNumber,
  parseEnrollmentNumber,
  type IEnrollmentSettings 
} from "@/models/Settings"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

// GET /api/students/next-enrollment - Get the next enrollment number
export async function GET() {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    await dbConnect()

    // Get enrollment settings
    const settingsDoc = await Settings.findOne({ key: 'enrollment' }).lean()
    const settings: IEnrollmentSettings = (settingsDoc?.value as unknown as IEnrollmentSettings) || DEFAULT_ENROLLMENT_SETTINGS
    
    const currentYear = new Date().getFullYear()
    
    // Check if we need to reset the sequence for a new year
    let shouldResetSequence = false
    if (settings.resetSequenceYearly && settings.lastResetYear !== currentYear) {
      shouldResetSequence = true
    }
    
    let nextSequence: number
    
    if (shouldResetSequence) {
      // Reset sequence to 1 for new year
      nextSequence = 1
      
      // Update settings with new year
      await Settings.findOneAndUpdate(
        { key: 'enrollment' },
        { 
          $set: { 
            'value.lastResetYear': currentYear,
            'value.currentSequence': 1
          }
        },
        { upsert: true }
      )
    } else {
      // Find the highest enrollment number using the current format
      // Build a regex pattern to match enrollment numbers from this year (if yearly reset) or all time
      let query: { enrollmentNumber: { $regex: string } } | Record<string, never> = {}
      
      if (settings.resetSequenceYearly) {
        // Only search for this year's enrollments
        const yearStr = currentYear.toString()
        const yearShortStr = yearStr.slice(-2)
        
        // Create a pattern that matches current year in the enrollment number
        if (settings.format.includes('{YEAR}')) {
          query = { enrollmentNumber: { $regex: yearStr } }
        } else if (settings.format.includes('{YEAR_SHORT}')) {
          query = { enrollmentNumber: { $regex: yearShortStr } }
        }
      }
      
      // Find all enrollment numbers and determine the max sequence
      const students = await Student.find(
        query,
        { enrollmentNumber: 1 }
      ).lean()
      
      let maxSequence = settings.currentSequence || 0
      
      for (const student of students) {
        if (student.enrollmentNumber) {
          const seq = parseEnrollmentNumber(student.enrollmentNumber, settings)
          if (seq !== null && seq > maxSequence) {
            maxSequence = seq
          }
        }
      }
      
      nextSequence = maxSequence + 1
    }
    
    // Generate the enrollment number
    const nextEnrollmentNumber = generateEnrollmentNumber(settings, nextSequence)
    
    // Also return a preview of the format for display
    const formatPreview = generateEnrollmentNumber(settings, 1)

    return NextResponse.json({ 
      enrollmentNumber: nextEnrollmentNumber,
      sequence: nextSequence,
      format: settings.format,
      formatPreview
    })
  } catch (error) {
    console.error("Error getting next enrollment number:", error)
    return NextResponse.json(
      { message: "حدث خطأ" },
      { status: 500 }
    )
  }
}
