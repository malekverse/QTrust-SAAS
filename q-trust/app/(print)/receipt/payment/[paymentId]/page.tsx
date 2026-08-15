import mongoose from "mongoose"
import { notFound, redirect } from "next/navigation"
import dbConnect from "@/lib/db"
import MonthlyPayment from "@/models/MonthlyPayment"
import Student from "@/models/Student"
import Tenant from "@/models/Tenant"
import { requireTenantSession, TenantAuthError } from "@/lib/tenant"
import { ROLES, MONTH_LABELS } from "@/lib/constants"
import { PrintButton } from "./print-button"

export const dynamic = "force-dynamic"

void Student
void Tenant

interface LeanPayment {
  _id: mongoose.Types.ObjectId
  month: number
  year: number
  isPaid: boolean
  amount?: number
  paidAt?: Date
  notes?: string
  studentId?: {
    firstName?: string
    lastName?: string
    fullName?: string
    enrollmentNumber?: string
    parentName?: string
  }
  markedByUserId?: { fullName?: string }
}

interface LeanTenant {
  name: string
  branding?: { displayName?: string; logoUrl?: string; primaryColor?: string }
  contact?: { phone?: string; address?: string }
}

interface ReceiptData {
  receiptNumber: string
  associationName: string
  logoUrl?: string
  primaryColor: string
  contactPhone?: string
  contactAddress?: string
  studentName: string
  enrollmentNumber?: string
  parentName?: string
  month: number
  year: number
  amount?: number
  paidAt?: Date
  markedBy?: string
  notes?: string
}

async function getReceipt(paymentId: string, tenantId: string): Promise<ReceiptData | null> {
  if (!mongoose.Types.ObjectId.isValid(paymentId)) return null
  await dbConnect()

  const payment = await MonthlyPayment.findOne({ _id: paymentId, tenantId })
    .populate("studentId", "firstName lastName fullName enrollmentNumber parentName")
    .populate("markedByUserId", "fullName")
    .lean<LeanPayment>()

  if (!payment || !payment.isPaid) return null

  const tenant = await Tenant.findById(tenantId).lean<LeanTenant>()
  if (!tenant) return null

  const student = payment.studentId
  const studentName =
    student?.fullName ||
    [student?.firstName, student?.lastName].filter(Boolean).join(" ") ||
    "طالب"

  // Human-readable receipt number: REC-YYYYMM-<last 6 of payment id>
  const idTail = String(payment._id).slice(-6).toUpperCase()
  const receiptNumber = `REC-${payment.year}${String(payment.month).padStart(2, "0")}-${idTail}`

  return {
    receiptNumber,
    associationName: tenant.branding?.displayName || tenant.name,
    logoUrl: tenant.branding?.logoUrl,
    primaryColor: tenant.branding?.primaryColor || "#136F4E",
    contactPhone: tenant.contact?.phone,
    contactAddress: tenant.contact?.address,
    studentName,
    enrollmentNumber: student?.enrollmentNumber,
    parentName: student?.parentName,
    month: payment.month,
    year: payment.year,
    amount: payment.amount,
    paidAt: payment.paidAt,
    markedBy: payment.markedByUserId?.fullName,
    notes: payment.notes,
  }
}

function formatDate(d?: Date) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("ar-TN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>
}) {
  const { paymentId } = await params

  let tenantId: string
  try {
    const ctx = await requireTenantSession()
    if (ctx.role !== ROLES.ADMIN) redirect("/auth/login")
    tenantId = ctx.tenantId
  } catch (e) {
    if (e instanceof TenantAuthError) redirect("/auth/login")
    throw e
  }

  const receipt = await getReceipt(paymentId, tenantId)
  if (!receipt) notFound()

  const monthLabel = MONTH_LABELS[receipt.month as keyof typeof MONTH_LABELS] || receipt.month
  const accent = receipt.primaryColor

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 print:p-0">
      {/* Toolbar (hidden when printing) */}
      <div className="no-print mb-6 flex items-center justify-between">
        <a href="/admin/subscriptions" className="text-sm text-neutral-500 hover:text-neutral-800">
          → العودة للاشتراكات
        </a>
        <PrintButton />
      </div>

      {/* Receipt sheet */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {/* Header band */}
        <div className="flex items-center justify-between gap-4 p-6" style={{ backgroundColor: accent }}>
          <div className="flex items-center gap-3 text-white">
            {receipt.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receipt.logoUrl} alt="" className="h-14 w-14 rounded-lg bg-white/10 object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/15 text-2xl font-bold">
                {receipt.associationName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold leading-tight">{receipt.associationName}</h1>
              {receipt.contactAddress && (
                <p className="text-xs text-white/80">{receipt.contactAddress}</p>
              )}
            </div>
          </div>
          <div className="text-left text-white">
            <p className="text-xs uppercase tracking-wide text-white/70">وصل خلاص</p>
            <p className="text-sm font-semibold" dir="ltr">{receipt.receiptNumber}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-sm text-neutral-500">وصل خلاص الاشتراك الشهري</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: accent }}>
              {monthLabel} {receipt.year}
            </p>
          </div>

          {/* Details grid */}
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-lg bg-neutral-50 p-5 text-sm sm:grid-cols-2 print:bg-neutral-50">
            <div className="flex justify-between border-b border-dashed border-neutral-200 pb-2">
              <dt className="text-neutral-500">الطالب</dt>
              <dd className="font-medium text-neutral-900">{receipt.studentName}</dd>
            </div>
            {receipt.enrollmentNumber && (
              <div className="flex justify-between border-b border-dashed border-neutral-200 pb-2">
                <dt className="text-neutral-500">رقم الانخراط</dt>
                <dd className="font-medium text-neutral-900" dir="ltr">{receipt.enrollmentNumber}</dd>
              </div>
            )}
            {receipt.parentName && (
              <div className="flex justify-between border-b border-dashed border-neutral-200 pb-2">
                <dt className="text-neutral-500">الولي</dt>
                <dd className="font-medium text-neutral-900">{receipt.parentName}</dd>
              </div>
            )}
            <div className="flex justify-between border-b border-dashed border-neutral-200 pb-2">
              <dt className="text-neutral-500">تاريخ الخلاص</dt>
              <dd className="font-medium text-neutral-900">{formatDate(receipt.paidAt)}</dd>
            </div>
          </dl>

          {/* Amount */}
          <div
            className="flex items-center justify-between rounded-lg px-5 py-4"
            style={{ backgroundColor: `${accent}12` }}
          >
            <span className="text-sm font-medium text-neutral-600">المبلغ المدفوع</span>
            <span className="text-2xl font-bold" style={{ color: accent }} dir="ltr">
              {typeof receipt.amount === "number" ? `${receipt.amount.toFixed(2)} د.ت` : "—"}
            </span>
          </div>

          {receipt.notes && (
            <div className="text-sm">
              <p className="text-neutral-500">ملاحظات</p>
              <p className="mt-1 text-neutral-800">{receipt.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-end justify-between border-t border-neutral-200 pt-5 text-xs text-neutral-500">
            <div>
              {receipt.markedBy && <p>سُجّل بواسطة: {receipt.markedBy}</p>}
              {receipt.contactPhone && <p dir="ltr">{receipt.contactPhone}</p>}
            </div>
            <div className="text-center">
              <div className="mb-1 h-12 w-32 border-b border-neutral-300" />
              <p>الختم والإمضاء</p>
            </div>
          </div>

          <p className="text-center text-[11px] text-neutral-400">
            بارك الله فيكم — هذا الوصل دليل على خلاص الاشتراك للشهر المذكور
          </p>
        </div>
      </div>
    </div>
  )
}
