import type { Metadata } from "next"
import { LeaderboardBoard } from "./board"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "لوحة الشرف",
  robots: { index: false },
}

export default async function LeaderboardDisplayPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  return <LeaderboardBoard slug={tenantSlug} />
}
