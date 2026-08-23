// Server-only email templates. Inline styles only (email clients strip
// <style> blocks). RTL where the tenant locale is 'ar', LTR otherwise.
//
// Outlook/desktop uses the Word rendering engine which ignores CSS on
// <html>/<body> — put `dir` on every <table> and rely on tables for layout.
// No web fonts (Outlook falls back to Times for Arabic without a fallback).

export type EmailLocale = 'ar' | 'fr' | 'en'

const BRAND_GREEN = '#136F4E'
const BRAND_GOLD = '#F4C76C'

// Wrap Latin snippets (URLs, phone numbers) so bidi doesn't garble them.
function ltr(s: string) {
  return `<span dir="ltr" style="unicode-bidi:embed">${escapeHtml(s)}</span>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function layout(opts: {
  locale: EmailLocale
  title: string
  bodyHtml: string
  footerHtml?: string
}): string {
  const isRtl = opts.locale === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const align = isRtl ? 'right' : 'left'
  const font = 'Tahoma, "Segoe UI", Arial, sans-serif'
  return `<!doctype html>
<html dir="${dir}" lang="${opts.locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f2ec;font-family:${font};color:#1c2321;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" align="${align}" style="background:#f5f2ec;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e6e0d3;border-radius:12px;overflow:hidden;">
        <tr>
          <td dir="${dir}" align="${align}" style="background:${BRAND_GREEN};padding:16px 20px;color:#ffffff;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}">
              <tr>
                <td dir="${dir}" align="${align}" style="font-size:18px;font-weight:700;color:#ffffff;">Q-Trust</td>
                <td dir="${dir}" align="${isRtl ? 'left' : 'right'}" style="font-size:12px;color:${BRAND_GOLD};">${escapeHtml(opts.title)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td dir="${dir}" align="${align}" style="padding:28px 24px 16px;font-size:15px;line-height:1.65;">
            ${opts.bodyHtml}
          </td>
        </tr>
        <tr>
          <td dir="${dir}" align="${align}" style="padding:16px 24px 24px;font-size:12px;color:#7a7a7a;border-top:1px solid #eee6d3;">
            ${opts.footerHtml ?? footerDefault(opts.locale)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

function footerDefault(locale: EmailLocale): string {
  const map: Record<EmailLocale, string> = {
    ar: 'صنع بـ ❤ في تونس · Q-Trust · هذه رسالة آلية، الرد لن يصل إلى صندوق مراقَب.',
    fr: 'Fait avec ❤ en Tunisie · Q-Trust · Message automatique, ne répondez pas à cette adresse.',
    en: 'Made with ❤ in Tunisia · Q-Trust · Automated message; replies are not monitored.',
  }
  return map[locale]
}

function button(label: string, href: string, locale: EmailLocale): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="margin:16px 0;">
  <tr>
    <td dir="ltr" align="center" bgcolor="${BRAND_GREEN}" style="border-radius:8px;">
      <a href="${escapeHtml(href)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:15px;background:${BRAND_GREEN};border-radius:8px;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`
}

// ─── Templates ────────────────────────────────────────────────────────────

export interface WelcomeActivationVars {
  locale: EmailLocale
  recipientName: string
  tenantName: string
  activationUrl: string
  loginUrl: string
  expiresAt: Date
  operatorName?: string
}

export function renderTenantWelcomeActivation(v: WelcomeActivationVars): { subject: string; html: string; text: string } {
  const l = v.locale
  const expiry = formatWhen(v.expiresAt, l)
  const t = ({
    ar: {
      subject: `مرحباً بك في Q-Trust — تفعيل حساب ${v.tenantName}`,
      greeting: `مرحباً ${v.recipientName}،`,
      p1: `تم إنشاء حساب مدير ${v.tenantName} على منصة <strong>Q-Trust</strong> لإدارة الحضور والمدفوعات والجداول.`,
      p2: 'اضغط على الزر أدناه لتعيين كلمة مرورك والدخول إلى لوحة التحكم:',
      button: 'تفعيل الحساب',
      hint: `يظل الرابط صالحاً حتى ${expiry}. لن يعمل بعدها.`,
      urlNote: 'إذا لم يعمل الزر، انسخ الرابط التالي والصقه في المتصفح:',
      loginNote: `بعد التفعيل يمكنك الدخول من: ${ltr(v.loginUrl)}`,
      operator: v.operatorName ? `أرسلت من قِبَل ${escapeHtml(v.operatorName)}` : '',
      textOnly:
        `مرحباً ${v.recipientName}،\n` +
        `تم إنشاء حساب مدير ${v.tenantName} على منصة Q-Trust.\n\n` +
        `فعّل حسابك من الرابط التالي (صالح حتى ${expiry}):\n${v.activationUrl}\n\n` +
        `رابط الدخول: ${v.loginUrl}\n`,
    },
    fr: {
      subject: `Bienvenue sur Q-Trust — activation de ${v.tenantName}`,
      greeting: `Bonjour ${v.recipientName},`,
      p1: `Un compte administrateur pour ${v.tenantName} vient d'être créé sur <strong>Q-Trust</strong>, la plateforme de gestion des présences, paiements et emplois du temps.`,
      p2: 'Cliquez sur le bouton ci-dessous pour définir votre mot de passe et accéder au tableau de bord :',
      button: 'Activer le compte',
      hint: `Ce lien est valable jusqu'au ${expiry}. Il cessera de fonctionner après cette date.`,
      urlNote: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
      loginNote: `Après activation, connectez-vous ici : ${ltr(v.loginUrl)}`,
      operator: v.operatorName ? `Envoyé par ${escapeHtml(v.operatorName)}` : '',
      textOnly:
        `Bonjour ${v.recipientName},\n` +
        `Un compte administrateur pour ${v.tenantName} vient d'être créé sur Q-Trust.\n\n` +
        `Activez votre compte via ce lien (valable jusqu'au ${expiry}) :\n${v.activationUrl}\n\n` +
        `Lien de connexion : ${v.loginUrl}\n`,
    },
    en: {
      subject: `Welcome to Q-Trust — activate ${v.tenantName}`,
      greeting: `Hi ${v.recipientName},`,
      p1: `An administrator account for ${v.tenantName} has been created on <strong>Q-Trust</strong>, the platform for attendance, payments and schedules.`,
      p2: 'Click the button below to set your password and reach the dashboard:',
      button: 'Activate account',
      hint: `This link is valid until ${expiry}. It will stop working after that.`,
      urlNote: 'If the button does not work, paste this URL into your browser:',
      loginNote: `After activation, sign in here: ${ltr(v.loginUrl)}`,
      operator: v.operatorName ? `Sent by ${escapeHtml(v.operatorName)}` : '',
      textOnly:
        `Hi ${v.recipientName},\n` +
        `An administrator account for ${v.tenantName} has been created on Q-Trust.\n\n` +
        `Activate your account with this link (valid until ${expiry}):\n${v.activationUrl}\n\n` +
        `Login URL: ${v.loginUrl}\n`,
    },
  } as const)[l]

  const bodyHtml = `
<p style="margin:0 0 12px;font-size:16px;">${escapeHtml(t.greeting)}</p>
<p style="margin:0 0 12px;">${t.p1}</p>
<p style="margin:0 0 6px;">${escapeHtml(t.p2)}</p>
${button(t.button, v.activationUrl, l)}
<p style="margin:8px 0 4px;color:#7a7a7a;font-size:13px;">${escapeHtml(t.hint)}</p>
<p style="margin:12px 0 4px;color:#7a7a7a;font-size:13px;">${escapeHtml(t.urlNote)}</p>
<p style="margin:0 0 14px;">${ltr(v.activationUrl)}</p>
<p style="margin:0 0 4px;color:#7a7a7a;font-size:13px;">${t.loginNote}</p>
${t.operator ? `<p style="margin:14px 0 0;color:#a0a0a0;font-size:12px;">${t.operator}</p>` : ''}
`

  return {
    subject: t.subject,
    html: layout({ locale: l, title: t.subject, bodyHtml }),
    text: t.textOnly,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatWhen(d: Date, locale: EmailLocale): string {
  const map: Record<EmailLocale, Intl.LocalesArgument> = {
    ar: 'ar-TN',
    fr: 'fr-TN',
    en: 'en-GB',
  }
  return new Intl.DateTimeFormat(map[locale], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Tunis',
  }).format(d)
}
