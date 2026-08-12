import dbConnect from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// Test endpoint for mobile app connectivity
// GET /api/attendance/test - Check if API is working and token is valid
export async function GET(request: NextRequest) {
  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    status: "checking",
  }

  // Check scanner token
  const token = request.headers.get("x-scanner-token")
  const validToken = process.env.SCANNER_DEVICE_TOKEN || "dev-scanner-token"
  
  result.tokenReceived = !!token
  result.tokenLength = token?.length || 0
  result.tokenValid = token === validToken
  
  if (!token) {
    result.status = "error"
    result.error = "No scanner token provided"
    return NextResponse.json(result, { status: 401 })
  }
  
  if (token !== validToken) {
    result.status = "error"
    result.error = "Invalid scanner token"
    result.hint = "Check SCANNER_DEVICE_TOKEN environment variable on Vercel"
    return NextResponse.json(result, { status: 401 })
  }

  // Check database connection
  try {
    await dbConnect()
    result.database = "connected"
  } catch (dbError: any) {
    result.database = "error"
    result.databaseError = dbError.message
    result.status = "error"
    return NextResponse.json(result, { status: 500 })
  }

  result.status = "ok"
  result.message = "API is working correctly"
  
  return NextResponse.json(result)
}

// POST /api/attendance/test - Test with body parsing
export async function POST(request: NextRequest) {
  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    method: "POST",
  }

  // Check scanner token
  const token = request.headers.get("x-scanner-token")
  const validToken = process.env.SCANNER_DEVICE_TOKEN || "dev-scanner-token"
  
  if (token !== validToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  // Parse body
  try {
    const body = await request.json()
    result.bodyReceived = true
    result.body = body
  } catch (e) {
    result.bodyReceived = false
    result.bodyError = "Failed to parse JSON body"
  }

  result.status = "ok"
  return NextResponse.json(result)
}
