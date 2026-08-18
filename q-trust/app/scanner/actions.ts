"use server"

import { headers } from "next/headers"

/**
 * Server action that proxies the scanner check-in call.
 * The scanner device token is read from the server-side environment
 * variable (SCANNER_DEVICE_TOKEN) and never sent to the client.
 */
export async function scannerCheckIn(qrUuid: string, scannedAt: string) {
  const token =
    process.env.SCANNER_DEVICE_TOKEN ||
    (process.env.NODE_ENV !== "production" ? "dev-scanner-token" : "")

  const headersList = await headers()
  const host = headersList.get("host") || "localhost:3000"
  const proto = headersList.get("x-forwarded-proto") || "http"
  const baseUrl = `${proto}://${host}`

  const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-scanner-token": token,
    },
    body: JSON.stringify({ qrUuid, scannedAt }),
  })

  const data = await res.json()
  return { ok: res.ok, data }
}
