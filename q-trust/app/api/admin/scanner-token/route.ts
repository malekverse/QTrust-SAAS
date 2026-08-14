import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

// GET /api/admin/scanner-token - reveal the scanner token to signed-in
// admins only. Replaces the old NEXT_PUBLIC_SCANNER_TOKEN display, which
// baked the credential into the public client bundle.
export async function GET() {
  const session = await auth()

  if (!session || session.user.role !== ROLES.ADMIN) {
    return NextResponse.json(
      { message: "غير مصرح لك بالوصول" },
      { status: 403 }
    )
  }

  const token =
    process.env.SCANNER_DEVICE_TOKEN ||
    (process.env.NODE_ENV !== "production" ? "dev-scanner-token" : null)

  return NextResponse.json({ token })
}
