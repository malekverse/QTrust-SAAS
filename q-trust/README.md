# Q-Trust — منصة إدارة جمعيات ومدارس تحفيظ القرآن

منصة SaaS متعددة المؤسسات لإدارة جمعيات ومدارس تحفيظ القرآن: الحضور بمسح QR، المدفوعات، والمتابعة — مطوَّرة في تونس.

## ✨ المميزات

### للمدير
- 🔐 **نظام مصادقة متكامل** - NextAuth مع صلاحيات المدير والمعلم
- 👨‍🏫 **إدارة المعلمين** - إنشاء وتعديل وحذف حسابات المعلمين
- 🎓 **إدارة الطلاب** - تسجيل الطلاب مع رموز QR فريدة قابلة للطباعة
- 📅 **جدولة الحصص** - إنشاء قوالب الحصص الأسبوعية مع كشف التعارضات
- 📊 **تقارير شاملة** - متابعة الحضور مع تصدير CSV
- ⚙️ **إعدادات النظام** - التحكم في نوافذ تسجيل الحضور

### للمعلم
- 📱 **لوحة تحكم شخصية** - عرض الحصص والطلاب
- ✏️ **تعديل الحضور** - تصحيح حالات الحضور مع الملاحظات
- 📈 **إحصائيات شخصية** - تحليل نسب الحضور لكل حصة

### للماسح الضوئي
- 📷 **تسجيل فوري** - مسح QR وتسجيل الحضور تلقائياً
- ✅ **رسائل تأكيد** - عرض اسم الطالب مع رسالة ترحيب إسلامية
- 🔒 **حماية بالرمز** - Token سري لمنع الوصول غير المصرح

## 🛠️ التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|-----------|
| **Next.js 16** | App Router + TypeScript |
| **MongoDB** | قاعدة البيانات عبر Mongoose |
| **NextAuth v5** | المصادقة والجلسات |
| **Tailwind CSS 4** | التنسيق |
| **shadcn/ui** | مكونات واجهة المستخدم |
| **TanStack Query** | إدارة البيانات والتخزين المؤقت |
| **Zod** | التحقق من البيانات |
| **Recharts** | الرسوم البيانية |
| **html5-qrcode** | مسح رموز QR |
| **qrcode** | إنشاء رموز QR |

## 🚀 البدء السريع

### المتطلبات

- Node.js 18+
- MongoDB (محلي أو Atlas)
- npm

### التثبيت

```bash
# استنساخ المشروع
git clone <repository-url>
cd q-trust

# تثبيت الحزم
npm install

# إعداد ملف البيئة
cp .env.example .env.local
# عدّل .env.local بإعداداتك

# تهيئة البيانات التجريبية
npm run seed

# تشغيل خادم التطوير
npm run dev
```

### متغيرات البيئة

أنشئ ملف `.env.local` بالمحتوى التالي:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/q-trust

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-32-chars-minimum

# Scanner Token (للحماية)
SCANNER_DEVICE_TOKEN=your-scanner-secret-token

# Cloudinary (لرفع الملفات)
# احصل على هذه القيم من: https://cloudinary.com/console
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# App
NEXT_PUBLIC_APP_NAME=Q-Trust
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### إعداد Cloudinary

لتفعيل رفع الملفات (صور الطلاب وبطاقات التعريف):

1. أنشئ حساباً مجانياً على [Cloudinary](https://cloudinary.com)
2. انتقل إلى [Dashboard](https://cloudinary.com/console)
3. انسخ قيم `Cloud Name` و `API Key` و `API Secret`
4. أضفها إلى ملف `.env.local`

## 👤 بيانات الدخول التجريبية

بعد تشغيل `npm run seed`:

| الدور | البريد | كلمة المرور |
|-------|--------|-------------|
| مدير | admin@demo.q-trust.tn | admin123 |
| معلم | teacher1@demo.q-trust.tn (…7) | teacher123 |
| طالب | student1@demo.q-trust.tn (…10) | student123 |

لإنشاء حساب مدير المنصة (Super Admin):

```bash
npm run create-super-admin
# → super@qtrust.local / ChangeMe-123!
```

## 📱 استخدام الماسح

1. افتح `/scanner?token=YOUR_TOKEN` على الجهاز اللوحي
2. وجّه الكاميرا نحو رمز QR الطالب
3. سيتم تسجيل الحضور تلقائياً مع رسالة ترحيب

## 📂 هيكل المشروع

```
q-trust/
├── app/
│   ├── admin/              # صفحات المدير
│   │   ├── dashboard/      # لوحة التحكم
│   │   ├── teachers/       # إدارة المعلمين
│   │   ├── students/       # إدارة الطلاب
│   │   ├── sessions/       # إدارة الحصص
│   │   ├── attendance/     # سجل الحضور
│   │   └── settings/       # الإعدادات
│   ├── teacher/            # صفحات المعلم
│   │   ├── dashboard/      # لوحة التحكم
│   │   ├── sessions/       # حصصي
│   │   ├── analytics/      # الإحصائيات
│   │   └── settings/       # الإعدادات
│   ├── scanner/            # واجهة الماسح
│   ├── auth/               # صفحات المصادقة
│   └── api/                # واجهات API
├── components/
│   ├── layout/             # مكونات التخطيط
│   ├── charts/             # الرسوم البيانية
│   ├── ui/                 # مكونات shadcn
│   └── providers/          # موفرو السياق
├── lib/
│   ├── auth.ts             # إعدادات NextAuth
│   ├── db.ts               # اتصال MongoDB
│   ├── utils.ts            # دوال مساعدة
│   ├── constants.ts        # ثوابت التطبيق
│   └── validations.ts      # مخططات Zod
├── models/                 # نماذج Mongoose
│   ├── User.ts             # المستخدم (مدير/معلم)
│   ├── Student.ts          # الطالب
│   ├── SessionTemplate.ts  # قالب الحصة
│   ├── SessionOccurrence.ts# حصة منفردة
│   ├── StudentSession.ts   # تسجيل طالب في حصة
│   ├── Attendance.ts       # سجل الحضور
│   └── ActivityLog.ts      # سجل النشاط
└── scripts/
    ├── seed.ts             # بيانات تجريبية
    └── test-db.ts          # اختبار الاتصال
```

## 🎨 التصميم الإسلامي

المنصة تستخدم لوحة ألوان إسلامية أنيقة:

| اللون | الكود | الاستخدام |
|-------|-------|-----------|
| الأخضر الأساسي | `#136F4E` | لون إسلامي عميق |
| الذهبي | `#F4C76C` | للتأكيدات |
| الأزرق الداكن | `#234E70` | للتباين |
| خلفية فاتحة | `#F8F5F0` | أبيض دافئ |
| خلفية داكنة | `#020817` | للوضع الداكن |

## 🔧 الأوامر المتاحة

```bash
npm run dev              # تشغيل خادم التطوير
npm run build            # بناء للإنتاج
npm start                # تشغيل خادم الإنتاج
npm run lint             # فحص الكود
npm run seed             # تهيئة البيانات التجريبية
npm run test-db          # اختبار اتصال قاعدة البيانات
npm run create-super-admin  # إنشاء حساب مدير المنصة
```

## 📊 البيانات التجريبية

عند تشغيل `npm run seed` يتم إنشاء:

- **3 معلمين** مع بيانات كاملة
- **10 طلاب** مع رموز QR
- **4 حصص أسبوعية** موزعة على الأيام
- **9 حصص منعقدة** للأسبوع الحالي
- **52 سجل حضور** متنوع
- **سجلات نشاط** للعمليات الأخيرة

## 🔐 الأمان

- كلمات المرور مشفرة بـ bcryptjs
- جلسات آمنة عبر NextAuth
- حماية API Routes
- Token سري للماسح الضوئي
- التحقق من البيانات بـ Zod

## 📝 الرخصة

هذا المشروع مرخص برخصة MIT.

---

<div align="center">
  <p>
    بسم الله الرحمن الرحيم<br>
    ﴿ إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ ﴾
  </p>
  <p>
    صُنع بـ ❤️ في تونس — Q-Trust
  </p>
</div>
