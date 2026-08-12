"use client"

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  CheckCircle2,
  XCircle,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface AIActionCardProps {
  actionId: string
  toolName: string
  description: string
  params: Record<string, unknown>
  onApprove: (actionId: string, modifiedParams?: Record<string, unknown>) => void
  onReject: (actionId: string) => void
  isExecuting: boolean
  status?: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'
}

function getActionMeta(toolName: string) {
  if (toolName.startsWith('create_') || toolName === 'enroll_student' || toolName === 'generate_occurrences') {
    return { icon: Plus, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', label: 'إنشاء' }
  }
  if (toolName.startsWith('update_') || toolName === 'mark_payment' || toolName === 'bulk_mark_payments' || toolName === 'review_claim' || toolName === 'auto_assign_rooms' || toolName === 'reset_student_password') {
    return { icon: Pencil, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', label: 'تعديل' }
  }
  if (toolName.startsWith('delete_') || toolName === 'unenroll_student') {
    return { icon: Trash2, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', label: 'حذف' }
  }
  return { icon: AlertTriangle, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', label: 'إجراء' }
}

const PARAM_LABELS: Record<string, string> = {
  name: 'الاسم',
  firstName: 'الاسم الأول',
  lastName: 'اللقب',
  fullName: 'الاسم الكامل',
  teacherId: 'معرف المعلم',
  studentId: 'معرف الطالب',
  roomId: 'معرف القاعة',
  sessionTemplateId: 'معرف الحصة',
  dayOfWeek: 'يوم الأسبوع (0-6)',
  startTime: 'وقت البداية',
  endTime: 'وقت النهاية',
  effectiveFromDate: 'تاريخ البداية',
  effectiveToDate: 'تاريخ النهاية',
  startDate: 'تاريخ البداية',
  endDate: 'تاريخ النهاية',
  date: 'التاريخ',
  email: 'البريد الإلكتروني',
  phone: 'الهاتف',
  gender: 'الجنس',
  cin: 'رقم الهوية',
  capacity: 'السعة',
  description: 'الوصف',
  status: 'الحالة',
  isPaid: 'مدفوع',
  month: 'الشهر',
  year: 'السنة',
  amount: 'المبلغ',
  notes: 'ملاحظات',
  isActive: 'نشط',
}

export function AIActionCard({
  actionId,
  toolName,
  description,
  params,
  onApprove,
  onReject,
  isExecuting,
  status,
}: AIActionCardProps) {
  const meta = getActionMeta(toolName)
  const Icon = meta.icon
  const isResolved = status && status !== 'pending'

  const [editedParams, setEditedParams] = useState<Record<string, unknown>>({ ...params })
  const [isEditing, setIsEditing] = useState(false)

  const entries = Object.entries(editedParams)
  const hasChanges = JSON.stringify(editedParams) !== JSON.stringify(params)

  const handleParamChange = (key: string, value: string) => {
    setEditedParams((prev) => {
      const original = params[key]
      let parsed: unknown = value

      if (typeof original === 'number') {
        const num = Number(value)
        if (!isNaN(num)) parsed = num
      } else if (typeof original === 'boolean') {
        parsed = value === 'true'
      }

      return { ...prev, [key]: parsed }
    })
  }

  const handleApprove = () => {
    if (hasChanges) {
      onApprove(actionId, editedParams)
    } else {
      onApprove(actionId)
    }
  }

  const handleReset = () => {
    setEditedParams({ ...params })
  }

  return (
    <Card className={cn('mb-3 mx-2 border overflow-hidden', meta.border, meta.bg)}>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn('p-1.5 rounded-lg', meta.bg)}>
            <Icon className={cn('w-4 h-4', meta.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <span className={cn('text-xs font-medium', meta.color)}>{meta.label}</span>
            <p className="text-sm font-medium text-foreground truncate">{description}</p>
          </div>
        </div>

        {entries.length > 0 && !isResolved && (
          <div className="bg-background/60 rounded-lg p-2 mb-2 text-xs space-y-1.5">
            {/* Show first 4 always, expand for rest */}
            {(isEditing ? entries : entries.slice(0, 4)).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-muted-foreground whitespace-nowrap min-w-[80px] text-right">
                  {PARAM_LABELS[key] || key}:
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                    className={cn(
                      'flex-1 px-2 py-1 rounded border bg-background text-foreground text-xs',
                      editedParams[key] !== params[key]
                        ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                        : 'border-border'
                    )}
                    dir="auto"
                  />
                ) : (
                  <span className="text-foreground font-medium truncate flex-1 text-left" dir="auto">
                    {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                  </span>
                )}
              </div>
            ))}
            {!isEditing && entries.length > 4 && (
              <div className="text-muted-foreground text-center">
                ... و {entries.length - 4} حقول أخرى
              </div>
            )}

            {/* Edit toggle */}
            <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <><ChevronUp className="w-3 h-3" /> إغلاق التعديل</>
                ) : (
                  <><Pencil className="w-3 h-3" /> تعديل القيم</>
                )}
              </Button>
              {isEditing && hasChanges && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] gap-1 text-amber-600"
                  onClick={handleReset}
                >
                  إعادة تعيين
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Read-only params for resolved actions */}
        {entries.length > 0 && isResolved && (
          <div className="bg-background/60 rounded-lg p-2 mb-2 text-xs space-y-0.5">
            {entries.slice(0, 6).map(([key, val]) => (
              <div key={key} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{PARAM_LABELS[key] || key}:</span>
                <span className="text-foreground font-medium truncate max-w-[60%] text-left" dir="auto">
                  {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                </span>
              </div>
            ))}
          </div>
        )}

        {isResolved ? (
          <div className={cn(
            'flex items-center gap-2 text-sm font-medium py-1',
            status === 'executed' ? 'text-emerald-600' :
            status === 'rejected' ? 'text-red-600' :
            status === 'failed' ? 'text-red-600' : 'text-muted-foreground'
          )}>
            {status === 'executed' && <><CheckCircle2 className="w-4 h-4" /> تم التنفيذ بنجاح</>}
            {status === 'rejected' && <><XCircle className="w-4 h-4" /> تم الرفض</>}
            {status === 'failed' && <><AlertTriangle className="w-4 h-4" /> فشل التنفيذ</>}
          </div>
        ) : (
          <div className="space-y-2">
            {hasChanges && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50/50 dark:bg-amber-950/20 rounded px-2 py-1">
                <Pencil className="w-3 h-3" />
                تم تعديل بعض القيم — سيتم التنفيذ بالقيم المعدّلة
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleApprove}
                disabled={isExecuting}
              >
                {isExecuting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {hasChanges ? 'موافقة (مع التعديلات)' : 'موافقة'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => onReject(actionId)}
                disabled={isExecuting}
              >
                <XCircle className="w-3.5 h-3.5" />
                رفض
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
