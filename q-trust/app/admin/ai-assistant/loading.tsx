import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function AIAssistantLoading() {
  return (
    <div className="flex flex-row-reverse gap-4 h-[calc(100vh-7rem)] max-h-[calc(100vh-7rem)]">
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex flex-col w-72 shrink-0">
        <Card className="flex flex-col h-full overflow-hidden border-border/60">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
          <div className="p-2 space-y-2 flex-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-2.5 rounded-lg">
                <Skeleton className="h-4 w-full mb-1.5" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Main chat skeleton */}
      <Card className="flex-1 flex flex-col overflow-hidden border-border/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" dir="ltr">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div>
              <Skeleton className="h-4 w-36 mb-1.5" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="w-2 h-2 rounded-full" />
        </div>

        {/* Content area */}
        <div className="flex-1 p-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8 pt-4">
              <Skeleton className="w-20 h-20 rounded-2xl mx-auto mb-5" />
              <Skeleton className="h-7 w-64 mx-auto mb-2" />
              <Skeleton className="h-4 w-80 mx-auto" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        {/* Input area */}
        <div className="border-t p-4 md:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3">
              <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
              <Skeleton className="h-12 flex-1 rounded-xl" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
