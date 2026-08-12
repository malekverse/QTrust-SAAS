/**
 * Date utility functions
 */

/**
 * Get current date formatted in Arabic
 */
export function getArabicDate(): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return new Date().toLocaleDateString('ar-SA', options);
}

/**
 * Get current time formatted in Arabic
 */
export function getArabicTime(): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Date().toLocaleTimeString('ar-SA', options);
}

/**
 * Format a date string to Arabic readable format
 */
export function formatArabicDateTime(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return date.toLocaleDateString('ar-SA', options);
}

/**
 * Get relative time in Arabic (e.g., "منذ 5 دقائق")
 */
export function getRelativeTimeArabic(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'الآن';
  }
  if (diffMin < 60) {
    return `منذ ${diffMin} ${diffMin === 1 ? 'دقيقة' : 'دقائق'}`;
  }
  if (diffHour < 24) {
    return `منذ ${diffHour} ${diffHour === 1 ? 'ساعة' : 'ساعات'}`;
  }
  if (diffDay < 7) {
    return `منذ ${diffDay} ${diffDay === 1 ? 'يوم' : 'أيام'}`;
  }
  
  return formatArabicDateTime(dateString);
}

/**
 * Get ISO string for current time
 */
export function getCurrentISOString(): string {
  return new Date().toISOString();
}

