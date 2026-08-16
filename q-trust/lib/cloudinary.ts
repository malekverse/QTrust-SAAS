import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }

// Base (tenant-agnostic) upload options per file type. The concrete Cloudinary
// folder is built per-tenant by getUploadOptions(), so no two tenants ever share
// a folder and one tenant's assets can't be enumerated/deleted by another.
const baseUploadOptions = {
  photo: {
    subfolder: 'students/photos',
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { quality: 'auto' },
      { fetch_format: 'auto' },
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  },
  cin_front: {
    subfolder: 'students/cin',
    transformation: [
      { width: 1200, height: 800, crop: 'limit' },
      { quality: 'auto' },
      { fetch_format: 'auto' },
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
  },
  cin_back: {
    subfolder: 'students/cin',
    transformation: [
      { width: 1200, height: 800, crop: 'limit' },
      { quality: 'auto' },
      { fetch_format: 'auto' },
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
  },
  document: {
    subfolder: 'documents',
    resource_type: 'auto' as const,
    allowed_formats: [
      'jpg', 'jpeg', 'png', 'webp', 'gif',
      'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt',
      'mp3', 'mp4', 'ogg', 'wav', 'webm',
    ],
  },
  receipt: {
    subfolder: 'payments/receipts',
    resource_type: 'auto' as const,
    transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
  },
}

export type UploadType = keyof typeof baseUploadOptions

// Every asset owned by a tenant lives under this prefix. Used to scope uploads
// and to authorize deletes (a public ID outside the caller's prefix is rejected).
export function tenantFolderPrefix(tenantId: string): string {
  return `q-trust/tenants/${tenantId}/`
}

// Build Cloudinary upload options for a file type, scoped to the tenant's folder.
export function getUploadOptions(uploadType: UploadType, tenantId: string) {
  const base = baseUploadOptions[uploadType] ?? baseUploadOptions.document
  const { subfolder, ...rest } = base
  return { ...rest, folder: `${tenantFolderPrefix(tenantId)}${subfolder}` }
}
