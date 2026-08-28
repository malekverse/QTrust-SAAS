import mongoose from 'mongoose'
import { NextResponse } from 'next/server'

// A malformed path id (e.g. /api/students/not-a-real-id) must be a client error.
// Without this guard Mongoose throws a CastError deep in the query and the
// route's catch-all turns it into a 500, which hides real server faults in
// monitoring. Call at the top of any handler that receives an id from the URL:
//
//   const bad = invalidObjectId(id)
//   if (bad) return bad
//
export function invalidObjectId(id: string | undefined | null): NextResponse | null {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
  }
  return null
}
