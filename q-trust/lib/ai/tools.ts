import type Groq from 'groq-sdk'

type ToolDef = Groq.Chat.Completions.ChatCompletionTool

export const READ_ONLY_TOOLS = new Set([
  'list_students',
  'get_student',
  'list_teachers',
  'get_teacher',
  'list_sessions',
  'get_session',
  'list_rooms',
  'get_room',
  'check_room_availability',
  'view_schedule',
  'check_conflicts',
  'view_attendance',
  'get_attendance_stats',
  'view_payments',
  'list_claims',
  'list_documents',
  'get_dashboard_stats',
  'get_activity_log',
  'get_settings',
])

export const AI_TOOLS: ToolDef[] = [
  // ─── Student Management ───
  {
    type: 'function',
    function: {
      name: 'list_students',
      description: 'البحث عن الطلاب أو عرض قائمة الطلاب مع إمكانية التصفية',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'نص البحث (اسم، رقم انخراط، رقم هوية)' },
          isActive: { type: 'boolean', description: 'تصفية حسب الحالة (نشط/غير نشط)' },
          limit: { type: 'integer', description: 'عدد النتائج (افتراضي 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_student',
      description: 'عرض تفاصيل طالب محدد بالمعرف أو الاسم',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف الطالب' },
          name: { type: 'string', description: 'اسم الطالب للبحث' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_student',
      description: 'إنشاء طالب جديد في النظام',
      parameters: {
        type: 'object',
        properties: {
          firstName: { type: 'string', description: 'الاسم' },
          lastName: { type: 'string', description: 'اللقب' },
          gender: { type: 'string', enum: ['MALE', 'FEMALE'], description: 'الجنس' },
          phone: { type: 'string', description: 'رقم الهاتف (+216XXXXXXXX)' },
          email: { type: 'string', description: 'البريد الإلكتروني' },
          cin: { type: 'string', description: 'رقم بطاقة التعريف (8 أرقام)' },
          fatherName: { type: 'string', description: 'اسم الأب' },
          dateOfBirth: { type: 'string', description: 'تاريخ الولادة (YYYY-MM-DD)' },
          address: { type: 'string', description: 'العنوان' },
          educationLevel: { type: 'string', description: 'المستوى التعليمي' },
          activityAreas: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['QURAN_MEMORIZATION', 'TAJWEED_QIRAAT', 'QURAN_SCIENCES', 'COMPETITIONS', 'YEAR_ROUND_ACTIVITY'],
            },
            description: 'مجالات النشاط',
          },
          notes: { type: 'string', description: 'ملاحظات' },
        },
        required: ['firstName', 'lastName', 'gender'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_student',
      description: 'تحديث بيانات طالب موجود',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف الطالب' },
          firstName: { type: 'string', description: 'الاسم' },
          lastName: { type: 'string', description: 'اللقب' },
          gender: { type: 'string', enum: ['MALE', 'FEMALE'], description: 'الجنس' },
          phone: { type: 'string', description: 'رقم الهاتف' },
          email: { type: 'string', description: 'البريد الإلكتروني' },
          cin: { type: 'string', description: 'رقم بطاقة التعريف' },
          address: { type: 'string', description: 'العنوان' },
          isActive: { type: 'boolean', description: 'حالة الحساب' },
          notes: { type: 'string', description: 'ملاحظات' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_student',
      description: 'إلغاء تنشيط طالب (حذف ناعم)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف الطالب' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_student_account',
      description: 'إنشاء حساب بوابة الطالب للوصول إلى المنصة',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'معرف الطالب' },
          email: { type: 'string', description: 'البريد الإلكتروني للحساب' },
          phone: { type: 'string', description: 'رقم الهاتف (+216XXXXXXXX)' },
        },
        required: ['studentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reset_student_password',
      description: 'إعادة تعيين كلمة مرور حساب طالب',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'معرف الطالب' },
        },
        required: ['studentId'],
      },
    },
  },

  // ─── Teacher Management ───
  {
    type: 'function',
    function: {
      name: 'list_teachers',
      description: 'عرض قائمة المعلمين',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'البحث بالاسم أو البريد' },
          isActive: { type: 'boolean', description: 'تصفية حسب الحالة' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_teacher',
      description: 'عرض تفاصيل معلم محدد',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف المعلم' },
          name: { type: 'string', description: 'اسم المعلم للبحث' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_teacher',
      description: 'إنشاء حساب معلم جديد',
      parameters: {
        type: 'object',
        properties: {
          fullName: { type: 'string', description: 'الاسم الكامل' },
          email: { type: 'string', description: 'البريد الإلكتروني' },
          phone: { type: 'string', description: 'رقم الهاتف (+216XXXXXXXX)' },
          password: { type: 'string', description: 'كلمة المرور (8 أحرف على الأقل)' },
        },
        required: ['fullName', 'email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_teacher',
      description: 'تحديث بيانات معلم',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف المعلم' },
          fullName: { type: 'string', description: 'الاسم الكامل' },
          email: { type: 'string', description: 'البريد الإلكتروني' },
          isActive: { type: 'boolean', description: 'حالة الحساب' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_teacher',
      description: 'إلغاء تنشيط حساب معلم',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف المعلم' },
        },
        required: ['id'],
      },
    },
  },

  // ─── Session Management ───
  {
    type: 'function',
    function: {
      name: 'list_sessions',
      description: 'عرض قائمة قوالب الحصص',
      parameters: {
        type: 'object',
        properties: {
          teacherId: { type: 'string', description: 'تصفية حسب المعلم' },
          dayOfWeek: { type: 'integer', description: 'تصفية حسب اليوم (0-6)' },
          isActive: { type: 'boolean', description: 'تصفية حسب الحالة' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_session',
      description: 'عرض تفاصيل حصة محددة مع الطلاب المسجلين',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف قالب الحصة' },
          name: { type: 'string', description: 'اسم الحصة للبحث' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_session',
      description: 'إنشاء قالب حصة جديد. يجب البحث عن المعلم أولاً بأداة get_teacher للحصول على الـ _id',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'اسم الحصة (مثل: حصة التجويد)' },
          teacherId: { type: 'string', description: 'معرف MongoDB للمعلم (ObjectId). استخدم get_teacher أولاً' },
          dayOfWeek: { type: 'integer', description: 'رقم يوم الأسبوع: 0=الأحد, 1=الإثنين, 2=الثلاثاء, 3=الأربعاء, 4=الخميس, 5=الجمعة, 6=السبت' },
          startTime: { type: 'string', description: 'وقت البداية بصيغة HH:mm (مثل: 10:00)' },
          endTime: { type: 'string', description: 'وقت النهاية بصيغة HH:mm (مثل: 12:00)' },
          roomId: { type: 'string', description: 'معرف MongoDB للقاعة (ObjectId اختياري)' },
          effectiveFromDate: { type: 'string', description: 'تاريخ بداية السريان بصيغة YYYY-MM-DD' },
          effectiveToDate: { type: 'string', description: 'تاريخ نهاية السريان بصيغة YYYY-MM-DD (اختياري)' },
          description: { type: 'string', description: 'وصف الحصة' },
        },
        required: ['name', 'teacherId', 'dayOfWeek', 'startTime', 'endTime', 'effectiveFromDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_session',
      description: 'تحديث قالب حصة',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف قالب الحصة' },
          name: { type: 'string', description: 'اسم الحصة' },
          teacherId: { type: 'string', description: 'معرف المعلم' },
          dayOfWeek: { type: 'integer', description: 'يوم الأسبوع (0-6)' },
          startTime: { type: 'string', description: 'وقت البداية (HH:mm)' },
          endTime: { type: 'string', description: 'وقت النهاية (HH:mm)' },
          roomId: { type: 'string', description: 'معرف القاعة' },
          isActive: { type: 'boolean', description: 'حالة الحصة' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_session',
      description: 'إلغاء تنشيط قالب حصة',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف قالب الحصة' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enroll_student',
      description: 'تسجيل طالب في حصة. استخدم get_student أولاً للحصول على studentId',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'معرف MongoDB للطالب (ObjectId)' },
          sessionTemplateId: { type: 'string', description: 'معرف MongoDB لقالب الحصة (ObjectId)' },
        },
        required: ['studentId', 'sessionTemplateId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'unenroll_student',
      description: 'إلغاء تسجيل طالب من حصة',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'معرف الطالب' },
          sessionTemplateId: { type: 'string', description: 'معرف قالب الحصة' },
        },
        required: ['studentId', 'sessionTemplateId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_occurrences',
      description: 'إنشاء حصص فعلية من القوالب لفترة زمنية محددة',
      parameters: {
        type: 'object',
        properties: {
          sessionTemplateId: { type: 'string', description: 'معرف MongoDB لقالب الحصة (ObjectId اختياري)' },
          startDate: { type: 'string', description: 'تاريخ البداية بصيغة YYYY-MM-DD' },
          endDate: { type: 'string', description: 'تاريخ النهاية بصيغة YYYY-MM-DD' },
        },
        required: ['startDate', 'endDate'],
      },
    },
  },

  // ─── Room Management ───
  {
    type: 'function',
    function: {
      name: 'list_rooms',
      description: 'عرض قائمة القاعات',
      parameters: {
        type: 'object',
        properties: {
          isActive: { type: 'boolean', description: 'تصفية حسب الحالة' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_room',
      description: 'عرض تفاصيل قاعة محددة',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف القاعة' },
          name: { type: 'string', description: 'اسم القاعة للبحث' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_room',
      description: 'إنشاء قاعة جديدة',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'اسم القاعة' },
          capacity: { type: 'integer', description: 'سعة القاعة' },
          description: { type: 'string', description: 'وصف القاعة' },
          location: { type: 'string', description: 'موقع القاعة' },
          features: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['WHITEBOARD', 'PROJECTOR', 'AC', 'COMPUTER', 'SOUND_SYSTEM', 'PRAYER_MATS', 'QURAN_COPIES'],
            },
            description: 'مميزات القاعة',
          },
        },
        required: ['name', 'capacity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_room',
      description: 'تحديث بيانات قاعة',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف القاعة' },
          name: { type: 'string', description: 'اسم القاعة' },
          capacity: { type: 'integer', description: 'سعة القاعة' },
          description: { type: 'string', description: 'وصف القاعة' },
          location: { type: 'string', description: 'موقع القاعة' },
          features: { type: 'array', items: { type: 'string' }, description: 'مميزات القاعة' },
          isActive: { type: 'boolean', description: 'حالة القاعة' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_room',
      description: 'إلغاء تنشيط قاعة',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف القاعة' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_room_availability',
      description: 'التحقق من توفر قاعة ومعرفة الحصص المجدولة فيها',
      parameters: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'معرف القاعة' },
          dayOfWeek: { type: 'integer', description: 'يوم الأسبوع (0-6)' },
        },
        required: ['roomId'],
      },
    },
  },

  // ─── Schedule ───
  {
    type: 'function',
    function: {
      name: 'view_schedule',
      description: 'عرض الجدول الزمني الأسبوعي',
      parameters: {
        type: 'object',
        properties: {
          teacherId: { type: 'string', description: 'معرف المعلم للتصفية (اختياري)' },
          roomId: { type: 'string', description: 'معرف القاعة للتصفية (اختياري)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_conflicts',
      description: 'كشف التعارضات في الجدول الزمني',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'auto_assign_rooms',
      description: 'تعيين القاعات تلقائياً للحصص التي لا تملك قاعة',
      parameters: {
        type: 'object',
        properties: {
          confirm: { type: 'boolean', description: 'تأكيد التعيين التلقائي' },
        },
      },
    },
  },

  // ─── Attendance ───
  {
    type: 'function',
    function: {
      name: 'view_attendance',
      description: 'عرض سجلات الحضور لتاريخ أو حصة أو طالب',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'التاريخ بصيغة YYYY-MM-DD' },
          sessionTemplateId: { type: 'string', description: 'معرف الحصة (ObjectId)' },
          studentId: { type: 'string', description: 'معرف الطالب (ObjectId)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_attendance',
      description: 'تحديث حالة حضور طالب في حصة',
      parameters: {
        type: 'object',
        properties: {
          attendanceId: { type: 'string', description: 'معرف سجل الحضور' },
          studentId: { type: 'string', description: 'معرف الطالب (بديل)' },
          sessionOccurrenceId: { type: 'string', description: 'معرف الحصة الفعلية (بديل)' },
          status: {
            type: 'string',
            enum: ['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED_ABSENCE'],
            description: 'حالة الحضور',
          },
          notes: { type: 'string', description: 'ملاحظات' },
        },
        required: ['status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_attendance_stats',
      description: 'عرض إحصائيات الحضور (إجمالي، حاضرون، غائبون)',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'التاريخ (YYYY-MM-DD)' },
          sessionTemplateId: { type: 'string', description: 'تصفية حسب الحصة' },
        },
      },
    },
  },

  // ─── Payments ───
  {
    type: 'function',
    function: {
      name: 'view_payments',
      description: 'عرض حالة المدفوعات الشهرية',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'integer', description: 'الشهر (1-12)' },
          year: { type: 'integer', description: 'السنة' },
          studentId: { type: 'string', description: 'تصفية حسب الطالب' },
          isPaid: { type: 'boolean', description: 'تصفية حسب حالة الدفع' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_payment',
      description: 'تسجيل أو إلغاء دفعة شهرية لطالب',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'معرف الطالب' },
          month: { type: 'integer', description: 'الشهر (1-12)' },
          year: { type: 'integer', description: 'السنة' },
          isPaid: { type: 'boolean', description: 'حالة الدفع' },
          amount: { type: 'number', description: 'المبلغ (اختياري)' },
          notes: { type: 'string', description: 'ملاحظات (اختياري)' },
        },
        required: ['studentId', 'month', 'year', 'isPaid'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bulk_mark_payments',
      description: 'تسجيل دفعات جماعية لعدة طلاب',
      parameters: {
        type: 'object',
        properties: {
          studentIds: { type: 'array', items: { type: 'string' }, description: 'قائمة معرفات الطلاب' },
          month: { type: 'integer', description: 'الشهر (1-12)' },
          year: { type: 'integer', description: 'السنة' },
          isPaid: { type: 'boolean', description: 'حالة الدفع' },
          amount: { type: 'number', description: 'المبلغ (اختياري)' },
        },
        required: ['studentIds', 'month', 'year', 'isPaid'],
      },
    },
  },

  // ─── Claims ───
  {
    type: 'function',
    function: {
      name: 'list_claims',
      description: 'عرض قائمة اعتراضات الحضور',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'], description: 'تصفية حسب الحالة' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'review_claim',
      description: 'مراجعة اعتراض حضور (قبول أو رفض)',
      parameters: {
        type: 'object',
        properties: {
          claimId: { type: 'string', description: 'معرف الاعتراض' },
          status: { type: 'string', enum: ['APPROVED', 'REJECTED'], description: 'القرار' },
          reviewNotes: { type: 'string', description: 'ملاحظات المراجعة' },
        },
        required: ['claimId', 'status'],
      },
    },
  },

  // ─── Documents ───
  {
    type: 'function',
    function: {
      name: 'list_documents',
      description: 'عرض قائمة المستندات التعليمية',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['QURAN_STUDY', 'TAJWEED', 'MEMORIZATION_GUIDE', 'EXAM_MATERIAL', 'GENERAL', 'COMPETITION', 'OTHER'],
            description: 'تصفية حسب الفئة',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_document',
      description: 'حذف مستند تعليمي',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'معرف المستند' },
        },
        required: ['id'],
      },
    },
  },

  // ─── Dashboard & Analytics ───
  {
    type: 'function',
    function: {
      name: 'get_dashboard_stats',
      description: 'عرض إحصائيات لوحة التحكم الشاملة',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_activity_log',
      description: 'عرض سجل النشاطات الأخيرة',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'عدد النتائج (افتراضي 20)' },
          type: { type: 'string', description: 'نوع النشاط' },
        },
      },
    },
  },

  // ─── Settings ───
  {
    type: 'function',
    function: {
      name: 'get_settings',
      description: 'عرض إعدادات النظام',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'مفتاح الإعداد (مثل: enrollment)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_settings',
      description: 'تحديث إعداد في النظام',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'مفتاح الإعداد' },
          value: { type: 'object', description: 'القيمة الجديدة' },
        },
        required: ['key', 'value'],
      },
    },
  },
]
