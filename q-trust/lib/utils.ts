import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('ar-TN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  }).format(d)
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('ar-TN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d)
}

export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} - ${formatTime(date)}`
}

export function getDayName(dayOfWeek: number): string {
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  return days[dayOfWeek] || ''
}

export function generateQrUuid(): string {
  return crypto.randomUUID()
}

export function getGreeting(): { greeting: string; subtitle: string } {
  const hour = new Date().getHours()
  
  if (hour < 12) {
    return {
      greeting: 'السلام عليكم ورحمة الله وبركاته',
      subtitle: 'نسأل الله أن يبارك في صباحكم وعملكم'
    }
  } else if (hour < 17) {
    return {
      greeting: 'السلام عليكم ورحمة الله وبركاته',
      subtitle: 'نسأل الله أن يبارك في عملكم اليوم'
    }
  } else {
    return {
      greeting: 'السلام عليكم ورحمة الله وبركاته',
      subtitle: 'جعل الله مساءكم خيراً وبركة'
    }
  }
}

export function calculateAttendanceStatus(
  checkInTime: Date,
  sessionStartTime: Date,
  lateThresholdMinutes: number = 10
): 'PRESENT' | 'LATE' {
  const diff = (checkInTime.getTime() - sessionStartTime.getTime()) / (1000 * 60)
  return diff > lateThresholdMinutes ? 'LATE' : 'PRESENT'
}

export function getAttendanceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'PRESENT': 'حاضر',
    'ABSENT': 'غائب',
    'LATE': 'متأخر',
    'JUSTIFIED_ABSENCE': 'غياب مبرر'
  }
  return labels[status] || status
}

export function getAttendanceStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'PRESENT': 'bg-emerald-500/20 text-emerald-700 font-semibold dark:bg-emerald-500/20 dark:text-emerald-400',
    'ABSENT': 'bg-red-500/20 text-red-700 font-semibold dark:bg-red-500/20 dark:text-red-400',
    'LATE': 'bg-amber-500/20 text-amber-700 font-semibold dark:bg-amber-500/20 dark:text-amber-400',
    'JUSTIFIED_ABSENCE': 'bg-blue-500/20 text-blue-700 font-semibold dark:bg-blue-500/20 dark:text-blue-400'
  }
  return colors[status] || 'bg-gray-500/20 text-gray-700 dark:text-gray-400'
}

