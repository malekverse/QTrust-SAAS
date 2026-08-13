// Marketing copy — single source of truth (§8.2.5: translate the validated
// pitch script into page copy, don't invent new positioning). The French
// variants (§8.3) will hang a parallel dictionary off this module.

// ── Real-data gates (§8.2.7: any number/quote that is not verifiably real →
// reject; an empty proof strip is better than a fake one). Fill these with
// REAL aggregates/quotes and the sections render automatically. ──
export const PROOF_STATS: { label: string; value: number; suffix?: string }[] | null = null
// e.g. [{ label: 'طالب مسجّل', value: 480 }, { label: 'تسجيل حضور', value: 52000, suffix: '+' }]

export const FOUNDING_ASSOCIATION: { name: string; logoSrc?: string } | null = null
// Requires written permission (§8.2.8) before it appears on the page.

export const TESTIMONIAL: { quote: string; name: string; role: string } | null = null
// One real quote from the founding association's director — or nothing.

// ── Product screenshots (§8.2.8 founder assets — captures from the seeded
// demo tenant only, never real students' data). Drop files in /public and
// point these at them; empty string = honest placeholder slot renders. ──
export const SHOTS = {
  dashboard: "", // e.g. '/marketing/dashboard.webp'
  qrCheckin: "",
  ledger: "",
  scannerPhone: "",
}

export const HERO = {
  // Line breaks are deliberate: each array item is one staggered reveal line.
  headlineLines: ["استبدل دفاتر الحضور الورقية", "بنظام رقمي متكامل"],
  goldPhrase: "بنظام رقمي متكامل", // receives the subtle gold underline
  subhead:
    "منصة Q-Trust تجمع حضور طلاب جمعيتك بمسح QR، ومتابعة المدفوعات، وتقارير المتابعة — في مكان واحد يعمل بالعربية.",
  ctaPrimary: "احجز عرضًا تجريبيًا",
  ctaSecondary: "شاهد المنصة",
}

// The three director pain points, verbatim from the field-pitch positioning.
export const PILLARS = [
  {
    title: "وفّر وقت كل حصة",
    body: "مسح بطاقة QR يسجّل حضور الطالب في ثانية، بدل المناداة بالأسماء ودفتر يُملأ يدويًا ثم يُفرَّغ في جدول آخر نهاية الشهر.",
    icon: "qr" as const,
  },
  {
    title: "لا غياب يمرّ بصمت",
    body: "لوحة التحكم تُظهر غيابات اليوم فور انطلاق الحصة، مع سجل كامل لكل طالب — فلا يكتشف الوليّ الانقطاع بعد شهر.",
    icon: "eye" as const,
  },
  {
    title: "اعرف من دفع ومن تأخّر",
    body: "دفتر اشتراكات شهري لكل طالب: مدفوع أو متأخّر، بضغطة واحدة، مع تصدير جاهز للتقارير المالية للجمعية.",
    icon: "ledger" as const,
  },
]

// The product tour's three beats (§8.2.2 #4).
export const TOUR_BEATS = [
  {
    key: "qr",
    title: "حضور بمسح QR",
    caption: "الطالب يمرّر بطاقته أمام الكاميرا — يُسجَّل حضوره فورًا مع نبضة نجاح خضراء يراها المشرف.",
    shot: "qrCheckin" as const,
  },
  {
    key: "dashboard",
    title: "لوحة تحكم حيّة",
    caption: "نظرة واحدة: حصص اليوم، نسبة الحضور، الغيابات، والاعتراضات المعلّقة — أرقام حقيقية تتحدّث لحظيًا.",
    shot: "dashboard" as const,
  },
  {
    key: "ledger",
    title: "دفتر المدفوعات",
    caption: "اشتراكات كل شهر أمامك: من دفع، من تأخّر، ومجموع المداخيل — بلا دفاتر ورقية ولا جداول متفرقة.",
    shot: "ledger" as const,
  },
]

export const AI_SPOTLIGHT = {
  eyebrow: "المساعد الذكي — باقة متقدّم",
  title: "اطلب بالعربية، ووافق قبل أي تنفيذ",
  body: "تكتب طلبك كما تقوله لموظف إداري: «سجّل دفع أحمد لشهر مارس». المساعد يبحث ويجهّز العملية، ثم يعرضها عليك في بطاقة موافقة — لا يُنفَّذ أي تغيير في بياناتك دون موافقتك الصريحة.",
  typedRequest: "سجّل دفع أحمد بن علي لشهر مارس",
  actionDescription: "تسجيل دفعة شهرية — أحمد بن علي، مارس",
  approveLabel: "موافقة وتنفيذ",
  rejectLabel: "رفض",
}

export const SCANNER = {
  eyebrow: "تطبيق الماسح + بطاقات QR",
  title: "جهاز لوحي عند الباب، وبطاقة لكل طالب",
  body: "تطبيق ماسح مخصّص يعمل على جهاز لوحي عند مدخل القاعة: الطالب يمرّر بطاقته، والنظام يتكفّل بالباقي. تُطبع بطاقات PVC بمعرّف QR لكل طالب وتُسلَّم عند التسجيل.",
  bullets: [
    "يعمل دون تدخّل المعلّم — الحصة تبدأ في وقتها",
    "بطاقات PVC مطبوعة باسم جمعيتك (خدمة إضافية)",
    "نبضة نجاح خضراء واضحة يراها الطالب والمشرف",
  ],
}

// §6.4 canonical pricing — UI defaults only; field sales negotiates per deal.
export const PRICING_TIERS = [
  {
    key: "starter",
    name: "مبتدئ",
    setup: "0 د.ت",
    annual: "0 د.ت / سنة",
    cap: "حتى 50 طالبًا",
    highlight: false,
    unlocks: "ابدأ مجانًا: حضور QR من المتصفح ودفتر مدفوعات أساسي.",
    features: [
      "حضور بمسح QR من المتصفح",
      "دفتر مدفوعات أساسي",
      "مقعد مدير واحد",
      "تجربة مجانية لمدة 14 يومًا",
    ],
  },
  {
    key: "standard",
    name: "احترافي",
    setup: "ابتداءً من 600 د.ت",
    annual: "350–450 د.ت / سنة",
    cap: "حتى 300 طالب",
    highlight: false,
    unlocks: "الماسح على جهاز لوحي، عمليات جماعية، وبوابة الوليّ.",
    features: [
      "كل ما في «مبتدئ»",
      "ربط تطبيق الماسح على جهاز لوحي",
      "عمليات دفع جماعية وتصدير CSV",
      "بوابة الطالب والوليّ",
      "مكتبة الوثائق التعليمية",
    ],
  },
  {
    key: "premium",
    name: "متقدّم",
    setup: "1,100 د.ت",
    annual: "650 د.ت / سنة",
    cap: "عدد طلاب غير محدود",
    highlight: true,
    unlocks: "المساعد الذكي بالعربية وتعدّد الفروع — بلا حدّ للطلاب.",
    features: [
      "كل ما في «احترافي»",
      "المساعد الذكي بالعربية (بموافقتك على كل عملية)",
      "دعم تعدّد الفروع",
      "أولوية في الدعم الفني",
    ],
  },
]

export const FINAL_CTA = {
  title: "جاهز ترى منصّتك تعمل ببيانات جمعيتك؟",
  body: "احجز عرضًا تجريبيًا مباشرًا — نصل إليك أو نلتقي عن بُعد، وتشاهد الحضور والمدفوعات تعمل أمامك.",
  cta: "احجز عرضًا تجريبيًا",
}
