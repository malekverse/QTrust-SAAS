import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Settings, { DEFAULT_ENROLLMENT_SETTINGS, type IEnrollmentSettings } from "@/models/Settings"
import { auth } from "@/lib/auth"

// GET /api/settings - Get all settings or specific setting by key
export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (key) {
      const setting = await Settings.findOne({ key }).lean()
      
      if (!setting) {
        // Return defaults for known settings
        if (key === 'enrollment') {
          return NextResponse.json({
            key: 'enrollment',
            value: DEFAULT_ENROLLMENT_SETTINGS,
            isDefault: true
          })
        }
        return NextResponse.json(
          { message: "الإعداد غير موجود" },
          { status: 404 }
        )
      }
      
      return NextResponse.json(setting)
    }

    // Return all settings
    const settings = await Settings.find().lean()
    
    // Ensure enrollment settings exist
    const hasEnrollment = settings.some(s => s.key === 'enrollment')
    if (!hasEnrollment) {
      settings.push({
        key: 'enrollment',
        value: DEFAULT_ENROLLMENT_SETTINGS,
        isDefault: true
      } as unknown as typeof settings[0])
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json(
      { message: "حدث خطأ في جلب الإعدادات" },
      { status: 500 }
    )
  }
}

// PUT /api/settings - Update a setting
export async function PUT(request: Request) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    await dbConnect()

    const body = await request.json()
    const { key, value, description } = body

    if (!key || !value) {
      return NextResponse.json(
        { message: "المفتاح والقيمة مطلوبان" },
        { status: 400 }
      )
    }

    // Validate enrollment settings
    if (key === 'enrollment') {
      const enrollmentValue = value as IEnrollmentSettings
      
      if (!enrollmentValue.format || !enrollmentValue.format.includes('{SEQ}')) {
        return NextResponse.json(
          { message: "صيغة رقم الانخراط يجب أن تحتوي على {SEQ}" },
          { status: 400 }
        )
      }
      
      if (enrollmentValue.sequencePadding < 1 || enrollmentValue.sequencePadding > 8) {
        return NextResponse.json(
          { message: "عدد خانات الرقم التسلسلي يجب أن يكون بين 1 و 8" },
          { status: 400 }
        )
      }
    }

    const setting = await Settings.findOneAndUpdate(
      { key },
      { 
        key,
        value,
        description,
        updatedBy: session.user.id
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true 
      }
    )

    return NextResponse.json({
      message: "تم حفظ الإعدادات بنجاح",
      setting
    })
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json(
      { message: "حدث خطأ في حفظ الإعدادات" },
      { status: 500 }
    )
  }
}
