/**
 * Create (or reset) a platform SUPER_ADMIN account — the operator who runs the
 * super-admin console and provisions tenants. A super-admin has NO tenantId.
 *
 * Usage:
 *   npx tsx scripts/create-super-admin.ts [email] [password] [fullName]
 * or set SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD in .env.local.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const MONGODB_URI = process.env.MONGODB_URI as string
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (create .env.local).')
  process.exit(1)
}

const email = (process.argv[2] || process.env.SUPER_ADMIN_EMAIL || 'super@qtrust.local')
  .toLowerCase()
  .trim()
const password = process.argv[3] || process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe-123!'
const fullName = process.argv[4] || 'مدير المنصة'

// Inline User schema (standalone script; tenantId is optional so a super-admin
// can exist without a tenant).
const UserSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
    fullName: String,
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true, sparse: true },
    role: { type: String, enum: ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT'], default: 'TEACHER' },
    passwordHash: String,
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', sparse: true },
  },
  { timestamps: true }
)

const User = mongoose.models.User || mongoose.model('User', UserSchema)

async function run() {
  console.log('🔌 Connecting...')
  await mongoose.connect(MONGODB_URI)

  const passwordHash = await bcrypt.hash(password, 12)
  const existing = await User.findOne({ email, role: 'SUPER_ADMIN' })

  if (existing) {
    existing.passwordHash = passwordHash
    existing.isActive = true
    existing.fullName = fullName
    await existing.save()
    console.log(`✅ Reset existing super-admin: ${email}`)
  } else {
    await User.create({
      fullName,
      email,
      role: 'SUPER_ADMIN',
      passwordHash,
      isEmailVerified: true,
      isActive: true,
      mustChangePassword: false,
    })
    console.log(`✅ Created super-admin: ${email}`)
  }

  console.log('\n🔑 Log in at /auth/login (NO tenant slug) with:')
  console.log(`   ${email} / ${password}`)
  console.log('   → you will be routed to /super-admin')

  await mongoose.disconnect()
  console.log('\n🔌 Disconnected')
}

run().catch((e) => {
  console.error('❌ Failed:', e)
  process.exit(1)
})
