import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function EditStudentLoading() {
  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Skeleton className="h-10 w-32" />

      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Form Sections */}
      <div className="space-y-6">
        {/* Personal Info Section */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Areas Section */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-48" />
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Declaration Section */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-24" />
          <Card>
            <CardContent className="p-4 space-y-4">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>

        {/* Files Section */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <Card>
            <CardContent className="p-4 space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Status */}
        <Skeleton className="h-20 w-full rounded-xl" />

        {/* Buttons */}
        <div className="flex gap-3">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
    </div>
  )
}
