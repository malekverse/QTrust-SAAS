import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function SessionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Filter */}
      <Skeleton className="h-10 w-48" />

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="grid grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 border-b last:border-0">
              <div className="grid grid-cols-6 gap-4 items-center">
                {[...Array(5)].map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
                <Skeleton className="h-8 w-8 ml-auto" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

