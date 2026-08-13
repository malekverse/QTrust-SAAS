import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cloudinary, getUploadOptions, tenantFolderPrefix, type UploadType } from '@/lib/cloudinary'
import { ROLES } from '@/lib/constants'

// Maximum file size per type (in bytes)
const MAX_FILE_SIZES: Record<string, number> = {
  photo: 5 * 1024 * 1024,      // 5MB for photos
  cin_front: 5 * 1024 * 1024,   // 5MB for CIN
  cin_back: 5 * 1024 * 1024,    // 5MB for CIN
  document: 25 * 1024 * 1024,   // 25MB for documents
}

// POST /api/upload - Upload a file to Cloudinary
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER)) {
      return NextResponse.json(
        { message: 'غير مصرح لك بالوصول' },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: 'لا يوجد سياق مؤسسة' }, { status: 403 })
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json(
        { message: 'خدمة رفع الملفات غير مهيأة' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const uploadType = formData.get('type') as UploadType | null

    if (!file) {
      return NextResponse.json(
        { message: 'الملف مطلوب' },
        { status: 400 }
      )
    }

    // Validate file size based on upload type
    const maxSize = MAX_FILE_SIZES[uploadType || 'document'] || MAX_FILE_SIZES.document
    const maxSizeMB = Math.round(maxSize / (1024 * 1024))
    if (file.size > maxSize) {
      return NextResponse.json(
        { message: `حجم الملف يجب أن لا يتجاوز ${maxSizeMB} ميغابايت` },
        { status: 400 }
      )
    }

    // Get upload options based on type, scoped to the caller's tenant folder
    const validType: UploadType =
      uploadType === 'photo' || uploadType === 'cin_front' || uploadType === 'cin_back'
        ? uploadType
        : 'document'
    const options = getUploadOptions(validType, tenantId)

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64, {
      ...options,
      resource_type: 'auto',
    })

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    
    // Handle specific Cloudinary errors
    if (error.message?.includes('File size too large')) {
      return NextResponse.json(
        { message: 'حجم الملف كبير جداً' },
        { status: 400 }
      )
    }
    
    if (error.message?.includes('Invalid image file')) {
      return NextResponse.json(
        { message: 'نوع الملف غير مدعوم' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: 'فشل في رفع الملف' },
      { status: 500 }
    )
  }
}

// DELETE /api/upload - Delete a file from Cloudinary
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json(
        { message: 'غير مصرح لك بالوصول' },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: 'لا يوجد سياق مؤسسة' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const publicId = searchParams.get('publicId')

    if (!publicId) {
      return NextResponse.json(
        { message: 'معرف الملف مطلوب' },
        { status: 400 }
      )
    }

    // Only allow deleting assets within the caller's OWN tenant folder, so a
    // guessed or foreign public ID (including another tenant's) cannot be removed.
    if (!publicId.startsWith(tenantFolderPrefix(tenantId))) {
      return NextResponse.json(
        { message: 'معرف الملف غير صالح' },
        { status: 400 }
      )
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId)

    return NextResponse.json({ message: 'تم حذف الملف بنجاح' })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { message: 'فشل في حذف الملف' },
      { status: 500 }
    )
  }
}
