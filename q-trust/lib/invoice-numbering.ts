import PlatformCounter from '@/models/PlatformCounter'

void PlatformCounter

// Atomic global per-year invoice counter. QT-YYYY-#### is monotone across
// every tenant so the customer-facing number is clean and printable.
//
// The atomicity comes from findOneAndUpdate with $inc + upsert on a
// unique key — Mongo serializes concurrent increments per document, so
// two parallel POSTs to /invoices can never mint the same number.
export async function generateInvoiceNumber(when: Date = new Date()): Promise<string> {
  const year = when.getUTCFullYear()
  const key = `invoice_number:${year}`
  const doc = await PlatformCounter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  ).lean<{ seq: number } | null>()
  const seq = doc?.seq ?? 1
  return `QT-${year}-${String(seq).padStart(4, '0')}`
}
