"use client"

import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Upload, X, FileImage, Loader2, CheckCircle, AlertCircle } from "lucide-react"

export type UploadType = 'photo' | 'cin_front' | 'cin_back' | 'document'

interface FileUploadProps {
  value?: string
  onChange?: (url: string | undefined) => void
  uploadType?: UploadType
  accept?: string
  maxSize?: number // in MB
  label?: string
  required?: boolean
  error?: string
  disabled?: boolean
  className?: string
  previewType?: 'image' | 'file'
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

/**
 * File upload component with Cloudinary integration
 * - Drag & drop upload
 * - Clear "required" markers
 * - Preview thumbnails for photos
 * - File preview links for documents
 * - Upload progress and success state
 * - File type and size validation
 * - Cloudinary upload with automatic optimization
 */
export function FileUpload({
  value,
  onChange,
  uploadType = 'document',
  accept = "image/*",
  maxSize = 5, // 5MB default
  label,
  required = false,
  error,
  disabled = false,
  className,
  previewType = 'image',
  /** Set to -1 to skip this component in tab order (useful in forms with many fields) */
  tabIndex = -1
}: FileUploadProps & { tabIndex?: number }) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [uploadState, setUploadState] = React.useState<UploadState>('idle')
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const dropzoneRef = React.useRef<HTMLDivElement>(null)

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      return `حجم الملف يجب أن لا يتجاوز ${maxSize} ميغابايت`
    }

    // Check file type
    const acceptTypes = accept.split(',').map(t => t.trim())
    const isValidType = acceptTypes.some(type => {
      if (type === '*/*') return true
      if (type.endsWith('/*')) {
        const category = type.slice(0, -2)
        return file.type.startsWith(category)
      }
      return file.type === type || file.name.endsWith(type.replace('*.', '.'))
    })

    if (!isValidType) {
      return 'نوع الملف غير مدعوم'
    }

    return null
  }

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', uploadType)

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'فشل في رفع الملف')
    }

    const data = await response.json()
    return data.url
  }

  const handleFile = async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setUploadError(validationError)
      setUploadState('error')
      return
    }

    setUploadState('uploading')
    setUploadError(null)
    setUploadProgress(0)

    // Simulate initial progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return prev
        }
        return prev + 10
      })
    }, 150)

    try {
      const url = await uploadToCloudinary(file)
      clearInterval(progressInterval)
      setUploadProgress(100)
      setUploadState('success')
      onChange?.(url)

      // Reset state after a delay
      setTimeout(() => {
        setUploadState('idle')
        setUploadProgress(0)
      }, 2000)
    } catch (err) {
      clearInterval(progressInterval)
      const message = err instanceof Error ? err.message : 'فشل في رفع الملف'
      setUploadError(message)
      setUploadState('error')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleRemove = () => {
    onChange?.(undefined)
    setUploadState('idle')
    setUploadError(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow Enter or Space to trigger file selection
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  // Check if the value is a Cloudinary URL for optimized display
  const isCloudinaryUrl = value?.includes('cloudinary.com') || value?.includes('res.cloudinary')

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-1 text-sm font-medium">
          {label}
          {required && <span className="text-destructive">*</span>}
        </div>
      )}

      {value ? (
        // Preview mode
        <div className="relative rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-4">
            {previewType === 'image' ? (
              <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted">
                {isCloudinaryUrl ? (
                  <Image 
                    src={value} 
                    alt="Preview" 
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={value} 
                    alt="Preview" 
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
                <FileImage className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                تم رفع الملف بنجاح
                {isCloudinaryUrl && (
                  <span className="text-xs text-muted-foreground mr-2">(Cloudinary)</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                اضغط على الزر لحذف الملف واختيار ملف آخر
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              disabled={disabled}
              tabIndex={-1}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      ) : (
        // Upload mode
        <div
          ref={dropzoneRef}
          role="button"
          tabIndex={disabled ? -1 : tabIndex}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label={label ? `${label} - اضغط للاختيار أو اسحب وأفلت` : 'اضغط للاختيار أو اسحب وأفلت ملف'}
          className={cn(
            "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isDragging && "border-primary bg-primary/5",
            uploadState === 'error' && "border-destructive bg-destructive/5",
            uploadState === 'success' && "border-emerald-500 bg-emerald-500/5",
            !isDragging && uploadState === 'idle' && "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            disabled={disabled}
            tabIndex={-1}
            className="sr-only"
            aria-hidden="true"
          />

          {uploadState === 'uploading' ? (
            <>
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium">جاري الرفع إلى السحابة...</p>
                <div className="mt-2 h-2 w-32 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{uploadProgress}%</p>
              </div>
            </>
          ) : uploadState === 'success' ? (
            <>
              <CheckCircle className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-600">تم الرفع بنجاح!</p>
            </>
          ) : uploadState === 'error' ? (
            <>
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div className="text-center">
                <p className="text-sm font-medium text-destructive">{uploadError}</p>
                <p className="text-xs text-muted-foreground mt-1">اضغط لإعادة المحاولة</p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-full bg-primary/10 p-3">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isDragging ? 'أفلت الملف هنا' : 'اسحب وأفلت الملف هنا'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  أو اضغط لاختيار ملف
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  الحد الأقصى: {maxSize} ميغابايت
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {(error || (uploadState === 'error' && uploadError)) && (
        <p className="text-sm text-destructive">
          {error || uploadError}
        </p>
      )}
    </div>
  )
}

export default FileUpload
