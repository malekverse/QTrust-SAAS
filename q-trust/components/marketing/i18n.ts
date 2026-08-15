export type MarketingLocale = "ar" | "fr"

export function getLocaleDir(locale: MarketingLocale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr"
}

// Nav/footer UI labels per locale
export const UI_LABELS = {
  ar: {
    features: "المميزات",
    pricing: "الأسعار",
    contact: "تواصل معنا",
    login: "تسجيل الدخول",
    bookDemo: "احجز عرضًا تجريبيًا",
    product: "المنتج",
    company: "الشركة",
    trustAndPrivacy: "الثقة والخصوصية",
    about: "من نحن",
    privacy: "سياسة الخصوصية",
    terms: "شروط الاستخدام",
    tagline: "منصة إدارة جمعيات ومدارس تحفيظ القرآن — الحضور، المدفوعات، والمتابعة في مكان واحد.",
    copyright: "جميع الحقوق محفوظة.",
    madeIn: "صُنع في تونس 🇹🇳",
    openMenu: "فتح القائمة",
    closeMenu: "إغلاق القائمة",
    homeLabel: "Q-Trust — الصفحة الرئيسية",
    switchLang: "FR",
    switchLangHref: "/fr",
  },
  fr: {
    features: "Fonctionnalités",
    pricing: "Tarifs",
    contact: "Contactez-nous",
    login: "Connexion",
    bookDemo: "Réserver une démo",
    product: "Produit",
    company: "Entreprise",
    trustAndPrivacy: "Confiance & confidentialité",
    about: "À propos",
    privacy: "Politique de confidentialité",
    terms: "Conditions d'utilisation",
    tagline: "Plateforme de gestion des associations et écoles coraniques — présence, paiements et suivi en un seul endroit.",
    copyright: "Tous droits réservés.",
    madeIn: "Conçu en Tunisie 🇹🇳",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    homeLabel: "Q-Trust — Accueil",
    switchLang: "ع",
    switchLangHref: "/",
  },
} as const
