import type { Metadata } from "next"
import { SignOutButton } from "./sign-out-button"

export const metadata: Metadata = {
  title: "الحساب معلّق",
  robots: { index: false },
}

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-neutral-900">الحساب معلّق مؤقتاً</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          تم تعليق وصول مؤسستكم إلى المنصة. غالباً ما يكون السبب متعلقاً بتجديد الاشتراك.
          يرجى التواصل مع إدارة المنصة لإعادة تفعيل الحساب.
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
