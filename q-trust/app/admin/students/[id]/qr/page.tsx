"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowRight, Download, Printer } from "lucide-react"

interface StudentQRData {
  _id: string
  fullName: string
  parentName?: string
  qrUuid: string
  qrDataUrl: string
}

async function fetchStudentQR(id: string): Promise<StudentQRData | null> {
  const res = await fetch(`/api/students/${id}/qr`)
  if (!res.ok) return null
  return res.json()
}

export default function StudentQRPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [data, setData] = useState<StudentQRData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStudentQR(id).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [id])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <div className="flex flex-col items-center gap-6">
          <Skeleton className="w-full max-w-md h-[500px]" />
        </div>
      </div>
    )
  }

  if (!data) {
    return <div>الطالب غير موجود</div>
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild className="no-print">
        <Link href={`/admin/students/${id}`}>
          <ArrowRight className="ml-2 h-4 w-4" />
          العودة للملف
        </Link>
      </Button>

      <div className="flex flex-col items-center gap-6">
        {/* QR Card for Print */}
        <Card className="w-full max-w-md qr-print-card" id="qr-card">
          <CardContent className="p-8 flex flex-col items-center">
            {/* Header */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-primary mb-1">
                جمعية المحافظة على القرآن الكريم
              </h1>
              <p className="text-sm text-muted-foreground">صفاقس - تونس</p>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-secondary to-transparent mb-6" />

            {/* QR Code */}
            <div className="p-4 bg-white rounded-xl shadow-inner border">
              <img 
                src={data.qrDataUrl} 
                alt="QR Code" 
                className="w-64 h-64"
              />
            </div>

            {/* Student Name */}
            <div className="text-center mt-6">
              <h2 className="text-2xl font-bold text-foreground">
                {data.fullName}
              </h2>
              {data.parentName && (
                <p className="text-muted-foreground mt-1">
                  ابن/ابنة {data.parentName}
                </p>
              )}
            </div>

            {/* QR UUID (small) */}
            <p className="text-xs text-muted-foreground mt-4 font-mono" dir="ltr">
              {data.qrUuid}
            </p>

            {/* Footer */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-secondary to-transparent mt-6 mb-4" />
            
            <p className="text-xs text-muted-foreground text-center">
              امسح هذا الرمز عند الدخول لتسجيل حضورك
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 no-print">
          <Button onClick={handlePrint}>
            <Printer className="ml-2 h-4 w-4" />
            طباعة
          </Button>
          <Button variant="outline" asChild>
            <a 
              href={data.qrDataUrl} 
              download={`qr-${data.fullName.replace(/\s+/g, '-')}.png`}
            >
              <Download className="ml-2 h-4 w-4" />
              تحميل PNG
            </a>
          </Button>
        </div>

        {/* Instructions */}
        <Card className="w-full max-w-md no-print">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">تعليمات الاستخدام</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• اطبع هذه البطاقة وقم بتغليفها</li>
              <li>• أعط البطاقة للطالب للاحتفاظ بها</li>
              <li>• يقوم الطالب بمسح الرمز عند الدخول لكل حصة</li>
              <li>• الرمز فريد ولا يتغير أبداً</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
