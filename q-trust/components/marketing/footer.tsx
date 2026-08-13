import Link from "next/link"
import { BrandLogo } from "@/components/brand-logo"

const PRODUCT_LINKS = [
  { href: "/features", label: "المميزات" },
  { href: "/pricing", label: "الأسعار" },
  { href: "/demo", label: "احجز عرضًا تجريبيًا" },
]

const COMPANY_LINKS = [
  { href: "/about", label: "من نحن" },
  { href: "/contact", label: "تواصل معنا" },
]

const TRUST_LINKS = [
  { href: "/privacy", label: "سياسة الخصوصية" },
  { href: "/terms", label: "شروط الاستخدام" },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-foreground/8">
      <div className="mk-container py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <BrandLogo variant="symbol" className="h-9 w-9" />
              <span className="mk-display text-lg font-bold" dir="ltr">Q-Trust</span>
            </div>
            <p className="mk-body text-sm max-w-[36ch]">
              منصة إدارة جمعيات ومدارس تحفيظ القرآن — الحضور، المدفوعات، والمتابعة في مكان واحد.
            </p>
          </div>

          <nav aria-label="المنتج" className="space-y-3">
            <p className="text-sm font-semibold">المنتج</p>
            <ul className="space-y-2">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="mk-nav-link text-sm">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="الشركة" className="space-y-3">
            <p className="text-sm font-semibold">الشركة</p>
            <ul className="space-y-2">
              {COMPANY_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="mk-nav-link text-sm">{l.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/auth/login" className="mk-nav-link text-sm">تسجيل الدخول</Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="الثقة والخصوصية" className="space-y-3">
            <p className="text-sm font-semibold">الثقة والخصوصية</p>
            <ul className="space-y-2">
              {TRUST_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="mk-nav-link text-sm">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mk-hairline-gold mt-12 pt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-foreground/50">
          <p>© {new Date().getFullYear()} Q-Trust. جميع الحقوق محفوظة.</p>
          <p dir="ltr">صُنع في تونس 🇹🇳</p>
        </div>
      </div>
    </footer>
  )
}
