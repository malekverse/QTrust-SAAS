"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowRight, Printer, Download, CheckSquare, Square } from "lucide-react"
import QRCode from "qrcode"
import { useTranslations } from "next-intl"

interface Student {
  _id: string
  fullName: string
  parentName?: string
  qrUuid: string
  isActive: boolean
}

async function fetchStudents(): Promise<Student[]> {
  const res = await fetch("/api/students?limit=200")
  if (!res.ok) throw new Error("Failed to fetch students")
  return (await res.json()).data
}

function QRCard({ student, qrDataUrl, orgName }: { student: Student; qrDataUrl: string; orgName: string }) {
  const t = useTranslations("admin.students")
  return (
    <div className="qr-card p-4 border rounded-xl bg-white text-black break-inside-avoid mb-4">
      {/* Header — the tenant's own branding, from the session */}
      <div className="text-center mb-3">
        <h3 className="text-sm font-bold text-emerald-700">{orgName}</h3>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent mb-3" />

      {/* QR Code */}
      <div className="flex justify-center mb-3">
        <div className="p-2 bg-gray-50 rounded-lg">
          <img src={qrDataUrl} alt="QR Code" className="w-24 h-24" />
        </div>
      </div>

      {/* Student Name */}
      <div className="text-center">
        <h4 className="font-bold text-lg">{student.fullName}</h4>
        {student.parentName && (
          <p className="text-sm text-gray-600">{t("childOf")} {student.parentName}</p>
        )}
      </div>

      {/* UUID */}
      <p className="text-center text-[10px] text-gray-400 mt-2 font-mono" dir="ltr">
        {student.qrUuid.slice(0, 8)}...
      </p>

      {/* Footer */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent mt-3 mb-2" />
      <p className="text-center text-[10px] text-gray-500">
        {t("scanToEnter")}
      </p>
    </div>
  )
}

export default function BulkQRCardsPage() {
  const { data: session } = useSession()
  const orgName = session?.user?.tenantName || "Q-Trust"
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [qrCodes, setQrCodes] = useState<Map<string, string>>(new Map())
  const [generating, setGenerating] = useState(false)

  const t = useTranslations("admin.students")
  const { data: students, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
  })

  const activeStudents = students?.filter(s => s.isActive) || []

  // Generate QR codes for selected students
  useEffect(() => {
    async function generateQRCodes() {
      if (selectedIds.size === 0) return
      
      setGenerating(true)
      const newQrCodes = new Map<string, string>()
      
      for (const id of selectedIds) {
        const student = activeStudents.find(s => s._id === id)
        if (student) {
          try {
            const qrDataUrl = await QRCode.toDataURL(student.qrUuid, {
              width: 200,
              margin: 1,
              color: {
                dark: "#136F4E",
                light: "#FFFFFF"
              },
              errorCorrectionLevel: "H"
            })
            newQrCodes.set(id, qrDataUrl)
          } catch (err) {
            console.error("Error generating QR for", student.fullName, err)
          }
        }
      }
      
      setQrCodes(newQrCodes)
      setGenerating(false)
    }

    generateQRCodes()
  }, [selectedIds, activeStudents])

  const toggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(activeStudents.map(s => s._id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header - Hidden on print */}
      <div className="no-print">
        <Button variant="ghost" asChild>
          <Link href="/admin/students">
            <ArrowRight className="ml-2 h-4 w-4" />
            {t("backToList")}
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-4">
          <div>
            <h1 className="text-2xl font-bold">{t("printQRCards")}</h1>
            <p className="text-muted-foreground">
              {t("selectStudentsToPrint")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={selectAll}>
              <CheckSquare className="ml-2 h-4 w-4" />
              {t("selectAll")}
            </Button>
            <Button variant="outline" onClick={deselectAll}>
              <Square className="ml-2 h-4 w-4" />
              {t("deselectAll")}
            </Button>
            <Button 
              onClick={handlePrint} 
              disabled={selectedIds.size === 0 || generating}
            >
              <Printer className="ml-2 h-4 w-4" />
              {t("printCount", { count: selectedIds.size })}
            </Button>
          </div>
        </div>
      </div>

      {/* Student Selection - Hidden on print */}
      <Card className="no-print">
        <CardContent className="p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeStudents.map((student) => (
              <div
                key={student._id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedIds.has(student._id)
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-muted"
                }`}
                onClick={() => toggleStudent(student._id)}
              >
                <Checkbox
                  checked={selectedIds.has(student._id)}
                  onCheckedChange={() => toggleStudent(student._id)}
                />
                <div>
                  <p className="font-medium">{student.fullName}</p>
                  {student.parentName && (
                    <p className="text-xs text-muted-foreground">
                      {student.parentName}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* QR Cards Preview / Print Area */}
      {selectedIds.size > 0 && (
        <div className="print-area">
          <h2 className="text-lg font-semibold mb-4 no-print">{t("cardsPreview")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-3">
            {Array.from(selectedIds).map((id) => {
              const student = activeStudents.find(s => s._id === id)
              const qrDataUrl = qrCodes.get(id)
              if (!student || !qrDataUrl) return null
              return (
                <QRCard key={id} student={student} qrDataUrl={qrDataUrl} orgName={orgName} />
              )
            })}
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .qr-card {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}

