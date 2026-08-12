import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }

// Upload options for different file types
export const uploadOptions = {
  photo: {
    folder: 'q-trust/students/photos',
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  },
  cin_front: {
    folder: 'q-trust/students/cin',
    transformation: [
      { width: 1200, height: 800, crop: 'limit' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
  },
  cin_back: {
    folder: 'q-trust/students/cin',
    transformation: [
      { width: 1200, height: 800, crop: 'limit' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
  },
  document: {
    folder: 'q-trust/documents',
    resource_type: 'auto' as const,
    allowed_formats: [
      'jpg', 'jpeg', 'png', 'webp', 'gif',
      'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt',
      'mp3', 'mp4', 'ogg', 'wav', 'webm'
    ],
  }
}

export type UploadType = keyof typeof uploadOptions
