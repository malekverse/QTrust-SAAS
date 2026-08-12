import { Card, CardContent } from "@/components/ui/card"

export default function ScheduleLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="h-8 bg-muted rounded w-48 animate-pulse" />
        <div className="h-4 bg-muted rounded w-72 animate-pulse" />
      </div>
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="h-10 bg-muted rounded" />
        </CardContent>
      </Card>
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-96 bg-muted rounded" />
        </CardContent>
      </Card>
    </div>
  )
}
