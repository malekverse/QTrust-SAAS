import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Enrollment Number Format Options:
 * - {YEAR} = Current year (e.g., 2026)
 * - {YEAR_SHORT} = Short year (e.g., 26)
 * - {SEQ} = Sequence number with padding
 * - {PREFIX} = Custom prefix
 * 
 * Examples:
 * - "{YEAR}-{SEQ}" → 2026-001
 * - "{PREFIX}/{YEAR}/{SEQ}" → QT/2026/001
 * - "{PREFIX}-{SEQ}" → QT-00001 (no year, continuous)
 * - "{YEAR_SHORT}{SEQ}" → 26001
 */

export interface IEnrollmentSettings {
  format: string           // e.g., "{YEAR}-{SEQ}" or "{PREFIX}/{YEAR}/{SEQ}"
  prefix: string           // Custom prefix (e.g., "QT", "STU", "")
  sequencePadding: number  // Number of digits for sequence (3, 4, 5)
  resetSequenceYearly: boolean  // Reset to 1 each year
  currentSequence: number  // Current sequence number
  lastResetYear: number    // Year when sequence was last reset
}

export interface ISettings extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  key: string              // Setting key (unique per tenant)
  value: Record<string, unknown>  // JSON value
  description?: string
  updatedBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const SettingsSchema = new Schema<ISettings>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    key: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: Schema.Types.Mixed,
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
)

// Setting key is unique per tenant (each tenant has its own enrollment config, etc.)
SettingsSchema.index({ tenantId: 1, key: 1 }, { unique: true })

// Default enrollment settings
export const DEFAULT_ENROLLMENT_SETTINGS: IEnrollmentSettings = {
  format: '{YEAR}-{SEQ}',
  prefix: '',
  sequencePadding: 3,
  resetSequenceYearly: true,
  currentSequence: 0,
  lastResetYear: new Date().getFullYear()
}

// Helper to generate enrollment number from settings
export function generateEnrollmentNumber(settings: IEnrollmentSettings, nextSeq: number): string {
  const year = new Date().getFullYear()
  const yearShort = year.toString().slice(-2)
  const paddedSeq = nextSeq.toString().padStart(settings.sequencePadding, '0')
  
  let result = settings.format
    .replace('{YEAR}', year.toString())
    .replace('{YEAR_SHORT}', yearShort)
    .replace('{SEQ}', paddedSeq)
    .replace('{PREFIX}', settings.prefix)
  
  // Clean up any double separators from empty prefix
  result = result.replace(/^[-\/]/, '').replace(/[-\/][-\/]+/g, '-').replace(/[-\/]$/, '')
  
  return result
}

// Parse enrollment number to extract sequence
export function parseEnrollmentNumber(enrollmentNumber: string, settings: IEnrollmentSettings): number | null {
  if (!enrollmentNumber) return null
  
  // Extract just the numeric sequence part
  // Try to find the sequence based on format pattern
  const year = new Date().getFullYear()
  const yearShort = year.toString().slice(-2)
  
  // Build a regex from the format
  let pattern = settings.format
    .replace('{YEAR}', '(\\d{4})')
    .replace('{YEAR_SHORT}', '(\\d{2})')
    .replace('{SEQ}', `(\\d{${settings.sequencePadding},})`)
    .replace('{PREFIX}', settings.prefix ? settings.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '')
  
  // Clean up the pattern
  pattern = pattern.replace(/^[-\/]/, '').replace(/[-\/][-\/]+/g, '[-\\/]').replace(/[-\/]$/, '')
  
  const regex = new RegExp(`^${pattern}$`)
  const match = enrollmentNumber.match(regex)
  
  if (match) {
    // Find which group is the sequence (last numeric group)
    const groups = match.slice(1)
    const seqStr = groups.find(g => g && g.length >= settings.sequencePadding && /^\d+$/.test(g))
    if (seqStr) {
      return parseInt(seqStr, 10)
    }
  }
  
  // Fallback: just extract the last number
  const numbers = enrollmentNumber.match(/\d+/g)
  if (numbers && numbers.length > 0) {
    return parseInt(numbers[numbers.length - 1], 10)
  }
  
  return null
}

const Settings: Model<ISettings> = mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema)

export default Settings
