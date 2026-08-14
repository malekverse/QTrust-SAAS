import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import ScannerDevice from "@/models/ScannerDevice"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

// GET /api/admin/scanner-devices - kiosk fleet health for the tenant admin.
// A device appears here once it has performed a successful check-in for a
// student of this tenant (that scan binds deviceId -> tenantId).
export async function GET() {
  try {
    const session = await auth()

    if (!session || session.user.role !== ROLES.ADMIN) {
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

    const devices = await ScannerDevice.find({ tenantId })
      .sort({ lastSeenAt: -1 })
      .limit(50)
      .lean()

    return NextResponse.json({ devices })
  } catch (error) {
    console.error("[ScannerDevices] Error:", error)
    return NextResponse.json(
      { message: "حدث خطأ في جلب الأجهزة" },
      { status: 500 }
    )
  }
}
