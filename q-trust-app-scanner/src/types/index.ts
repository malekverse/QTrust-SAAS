/**
 * Type definitions for Q-Trust App Scanner
 */

// Scanner status states
export type ScannerStatus =
  | 'IDLE'
  | 'SCANNING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'ERROR'
  | 'QUEUED';

// Which camera the kiosk uses (changeable from the protected settings screen)
export type CameraFacing = 'front' | 'back';

// A check-in captured while offline, waiting to be synced
export interface PendingScan {
  id: string;
  qrUuid: string;
  scannedAt: string; // original scan time (ISO), preserved so late sync keeps true timestamps
  attempts: number;
}

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
    apiBaseUrl: 'https://q-trust-saas.vercel.app',
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
  errorNotConfigured: 'الجهاز غير مهيأ — يرجى إدخال رمز الماسح في الإعدادات',

  // Offline queue
  queuedTitle: 'تم حفظ عملية المسح',
  // Cause-specific: true offline vs. server reachable-but-erroring
  queuedMessageOffline: 'لا يوجد اتصال بالإنترنت حاليًا. تم حفظ الحضور وستتم مزامنته تلقائيًا عند عودة الاتصال',
  queuedMessageServer: 'تعذّر الوصول إلى الخادم مؤقتًا. تم حفظ الحضور وستتم مزامنته تلقائيًا',
  pendingSyncLabel: 'بانتظار المزامنة',
  syncNow: 'مزامنة الآن',
  syncDone: (n: number) => `تمت مزامنة ${n} من عمليات المسح`,
  syncNothing: 'لا توجد عمليات مسح بانتظار المزامنة',
  syncStillOffline: 'لا يزال الاتصال بالخادم غير متاح',

  // Attendance status chips
  statusPresent: 'حاضر',
  statusLate: 'متأخر',
  statusAlready: 'مسجل مسبقًا',

  // Camera
  cameraLabel: 'الكاميرا',
  cameraFront: 'الأمامية',
  cameraBack: 'الخلفية',

  // Demo / recording mode
  demoModeLabel: 'وضع العرض التوضيحي',
  demoModeHint: 'يستبدل الكاميرا بخلفية مزخرفة ويشغّل عملية مسح تجريبية متكررة — لالتقاط صور وفيديو احترافية للتطبيق. يُعاد ضبطه تلقائيًا عند إعادة تشغيل التطبيق.',
  demoSessionName: 'حلقة تحفيظ القرآن الكريم',

  // Settings PIN
  pinLabel: 'رمز حماية الإعدادات (PIN)',
  pinEnterPrompt: 'أدخل رمز الحماية للوصول إلى الإعدادات',
  pinPlaceholder: 'رمز PIN (4-8 أرقام)',
  pinConfirmPlaceholder: 'تأكيد رمز PIN',
  pinWrong: 'رمز PIN غير صحيح',
  pinMismatch: 'رمزا PIN غير متطابقين',
  pinInvalid: 'يجب أن يتكون الرمز من 4 إلى 8 أرقام',
  pinSet: 'تعيين الرمز',
  pinChange: 'تغيير الرمز',
  pinRemove: 'إزالة الرمز',
  pinSaved: 'تم حفظ رمز الحماية',
  pinRemoved: 'تمت إزالة رمز الحماية',
  pinOptionalHint: 'اختياري — يمنع فتح الإعدادات دون إذن',
  
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
