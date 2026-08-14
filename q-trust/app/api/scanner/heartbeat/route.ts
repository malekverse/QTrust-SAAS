import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import ScannerDevice from "@/models/ScannerDevice"
import { verifyScannerToken } from "@/lib/scanner-auth"
import { scannerHeartbeatSchema } from "@/lib/validations"
import { checkInLimiter, enforceRateLimit, getClientIp } from "@/lib/rate-limit"

// POST /api/scanner/heartbeat - kiosk devices report their health here.
// Auth: the same scanner token as check-in. The heartbeat never sets
// tenantId — that binding happens on the device's first successful check-in.
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(checkInLimiter, `heartbeat:${getClientIp(request)}`)
    if (limited) return limited

    if (!verifyScannerToken(request)) {
      return NextResponse.json(
        { message: "غير مصرح بالوصول" },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { message: "بيانات الطلب غير صالحة" },
        { status: 400 }
      )
    }

    const parsed = scannerHeartbeatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { deviceId, ...telemetry } = parsed.data

    await dbConnect()
    await ScannerDevice.findOneAndUpdate(
      { deviceId },
      { $set: { ...telemetry, lastSeenAt: new Date() } },
      { upsert: true, setDefaultsOnInsert: true }
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Heartbeat] Error:", error)
    return NextResponse.json(
      { message: "حدث خطأ" },
      { status: 500 }
    )
  }
}
