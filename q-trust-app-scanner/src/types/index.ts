/**
 * Type definitions for Q-Trust App Scanner
 */

// Scanner status states
export type ScannerStatus = 
  | 'IDLE'
  | 'SCANNING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'ERROR';

// Attendance status from backend
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'JUSTIFIED_ABSENCE';

// Device configuration
export interface DeviceConfig {
  apiBaseUrl: string;
  deviceToken: string;
  deviceId: string;
  isConfigured: boolean;
}

// Theme mode
export type ThemeMode = 'light' | 'dark' | 'system';

// Scan record for history
export interface ScanRecord {
  id: string;
  qrUuid: string;
  studentName: string;
  sessionName?: string;
  scannedAt: string;
  success: boolean;
  status?: AttendanceStatus;
  errorMessage?: string;
  alreadyCheckedIn?: boolean;
}

// Environment presets for setup
export interface EnvironmentPreset {
  id: string;
  name: string;
  nameAr: string;
  apiBaseUrl: string;
}

export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
  {
    id: 'production',
    name: 'Production',
    nameAr: 'الإنتاج',
    apiBaseUrl: 'https://q-trust.vercel.app',
  },
  {
    id: 'custom',
    name: 'Custom',
    nameAr: 'مخصص',
    apiBaseUrl: '',
  },
];

// Arabic messages for various states
export const ARABIC_MESSAGES = {
  // Greetings
  greeting: 'السلام عليكم ورحمة الله وبركاته',
  welcomeSubtitle: 'مرحبًا بكم في منصة حضور جمعية المحافظة على القرآن الكريم',
  scanPrompt: 'قم بمسح رمز QR للتسجيل',
  scanning: 'جارٍ المسح...',
  processing: 'جارٍ التحقق...',
  
  // Success messages
  successGreeting: (name: string) => `مرحبًا يا ${name} 🌿`,
  successMessage: 'تم تسجيل حضورك بنجاح ✅',
  successMessageLate: 'تم تسجيل حضورك بنجاح (متأخر)',
  alreadyCheckedIn: 'تم تسجيل حضورك مسبقاً',
  
  // Blessing messages (random)
  blessings: [
    'زادك الله حرصًا على كتابه 🤍',
    'بارك الله فيك 📖',
    'جزاك الله خيراً ✨',
    'جعلك الله من أهل القرآن 🌙',
  ],
  
  // Error messages (from backend)
  errorInvalidQr: 'رمز QR غير صالح أو الطالب غير مسجل',
  errorNoSession: 'لا توجد حصة نشطة لك في هذا الوقت',
  errorNotEnrolled: 'لم يتم تسجيلك في أي حصة',
  errorContactAdmin: 'يرجى مراجعة الإدارة',
  errorNetwork: 'حدث خطأ في الاتصال',
  errorUnauthorized: 'غير مصرح بالوصول',
  
  // Setup
  setupTitle: 'إعداد الجهاز',
  setupSubtitle: 'قم بإعداد الجهاز للاتصال بالخادم',
  apiUrlLabel: 'عنوان الخادم',
  deviceTokenLabel: 'رمز الماسح',
  saveSettings: 'حفظ الإعدادات',
  
  // Settings
  settingsTitle: 'الإعدادات',
  themeLabel: 'المظهر',
  lightMode: 'فاتح',
  darkMode: 'داكن',
  systemMode: 'تلقائي',
  
  // Actions
  scanAnother: 'مسح رمز آخر',
  retry: 'إعادة المحاولة',
  cancel: 'إلغاء',
  confirm: 'تأكيد',
} as const;

// Helper to get random blessing
export function getRandomBlessing(): string {
  const blessings = ARABIC_MESSAGES.blessings;
  return blessings[Math.floor(Math.random() * blessings.length)];
}

// Legacy export for compatibility
export function getRandomSuccessSubtext(): string {
  return getRandomBlessing();
}
