import nodemailer, { type Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import dbConnect from '@/lib/db'
import EmailLog, { type EmailLogStatus, type EmailTemplateKey } from '@/models/EmailLog'
import mongoose from 'mongoose'

// SMTP transport for platform emails (activation link, credentials resend,
// invoice notices, new-lead alerts). Never throws — every call writes an
// EmailLog row (SENT / FAILED / SKIPPED) and returns a status. Modeled on
// lib/notifications/messaging.ts sendMessage() so operator-facing surfaces
// can treat both channels the same way.
//
// Serverless notes:
//   - We do NOT enable connection pooling. `pool: true` holds a socket that
//     the function-freeze kills; the next invocation gets ECONNRESET.
//   - Explicit timeouts so a hung SMTP host can't stall a request forever.

let cachedTransporter: Transporter | null | undefined

function readConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS
  const from = process.env.EMAIL_FROM?.trim() || (user ? `Q-Trust <${user}>` : undefined)
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465
  return { host, port, user, pass, from, secure }
}

export function emailReady(): boolean {
  const c = readConfig()
  return Boolean(c.host && c.user && c.pass && c.from)
}

async function getTransporter(): Promise<Transporter | null> {
  if (cachedTransporter !== undefined) return cachedTransporter
  const c = readConfig()
  if (!c.host || !c.user || !c.pass) {
    cachedTransporter = null
    return null
  }
  try {
    // `pool` defaults to false for SMTPTransport — we deliberately don't
    // enable it (frozen sockets kill invocations in serverless).
    const opts: SMTPTransport.Options = {
      host: c.host,
      port: c.port,
      secure: c.secure,
      auth: { user: c.user, pass: c.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    }
    cachedTransporter = nodemailer.createTransport(opts)
    return cachedTransporter
  } catch (err) {
    console.error('email: transporter init failed —', (err as Error).message)
    cachedTransporter = null
    return null
  }
}

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text?: string
  template: EmailTemplateKey | string
  tenantId?: mongoose.Types.ObjectId | string
  targetUserId?: mongoose.Types.ObjectId | string
  createdBy?: mongoose.Types.ObjectId | string
  // Reply-To (default: EMAIL_FROM). Useful when the operator wants replies
  // to land in their own inbox rather than the transactional sender.
  replyTo?: string
}

export interface SendEmailResult {
  status: EmailLogStatus
  error?: string
}

async function writeLog(input: SendEmailInput, status: EmailLogStatus, error?: string): Promise<void> {
  try {
    await dbConnect()
    await EmailLog.create({
      to: input.to,
      subject: input.subject,
      template: input.template,
      status,
      error,
      tenantId: input.tenantId ? new mongoose.Types.ObjectId(input.tenantId) : undefined,
      targetUserId: input.targetUserId ? new mongoose.Types.ObjectId(input.targetUserId) : undefined,
      createdBy: input.createdBy ? new mongoose.Types.ObjectId(input.createdBy) : undefined,
    })
  } catch (logErr) {
    // Never let a log-write failure break the caller.
    console.error('email: log write failed —', (logErr as Error).message)
  }
}

// Send an email. Guaranteed to write an EmailLog and never throw.
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const c = readConfig()
  if (!c.host || !c.user || !c.pass || !c.from) {
    const status: SendEmailResult = { status: 'SKIPPED', error: 'SMTP not configured' }
    await writeLog(input, status.status, status.error)
    return status
  }
  const t = await getTransporter()
  if (!t) {
    const status: SendEmailResult = { status: 'FAILED', error: 'Transporter unavailable' }
    await writeLog(input, status.status, status.error)
    return status
  }
  try {
    await t.sendMail({
      from: c.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    })
    await writeLog(input, 'SENT')
    return { status: 'SENT' }
  } catch (err) {
    const msg = (err as Error).message || 'sendMail failed'
    await writeLog(input, 'FAILED', msg)
    return { status: 'FAILED', error: msg }
  }
}

// The platform-side notification target (you). Set to a real inbox in
// PLATFORM_NOTIFY_EMAIL — falls back to the SMTP user or EMAIL_FROM address
// so it always reaches someone in dev.
export function platformNotifyAddress(): string | null {
  return (
    process.env.PLATFORM_NOTIFY_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    null
  )
}
