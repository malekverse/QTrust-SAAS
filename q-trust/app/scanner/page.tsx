"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, XCircle, Loader2, Camera, RefreshCw, Sparkles, AlertTriangle } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"

// Pre-computed confetti data to avoid Math.random during render
const CONFETTI_PARTICLES = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  left: (i * 17 + 7) % 100, // Deterministic pseudo-random spread
  delay: (i * 0.01) % 0.5,
  colorIndex: i % 5,
}))

const CONFETTI_COLORS = ["#136F4E", "#F4C76C", "#234E70", "#22c55e", "#FFD700"]

// Confetti particles component
function Confetti() {
  return (
    <div className="confetti-container absolute inset-0 overflow-hidden pointer-events-none">
      {CONFETTI_PARTICLES.map((particle) => (
        <div
          key={particle.id}
          className="confetti-particle"
          style={{
            left: `${particle.left}%`,
            animationDelay: `${particle.delay}s`,
            backgroundColor: CONFETTI_COLORS[particle.colorIndex],
          }}
        />
      ))}
    </div>
  )
}

interface ScanResult {
  success: boolean
  studentName?: string
  sessionName?: string
  message: string
  subtitle?: string
}

export default function ScannerPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScanRef = useRef<string | null>(null)
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleScan = useCallback(async (qrUuid: string) => {
    // Prevent duplicate scans
    if (lastScanRef.current === qrUuid) return
    lastScanRef.current = qrUuid

    try {
      const res = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-scanner-token": process.env.NEXT_PUBLIC_SCANNER_TOKEN || "dev-scanner-token"
        },
        body: JSON.stringify({
          qrUuid,
          scannedAt: new Date().toISOString(),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setScanResult({
          success: true,
          studentName: data.studentName,
          sessionName: data.sessionName,
          message: `مرحبًا يا ${data.studentName} 🌿`,
          subtitle: "تم تسجيل حضورك في حصة اليوم بنجاح ✅\nزادك الله حرصًا على كتابه 🤍",
        })
      } else {
        setScanResult({
          success: false,
          message: data.message || "حدث خطأ",
          subtitle: "يرجى مراجعة الإدارة",
        })
      }

      // Reset after 3 seconds
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current)
      resetTimeoutRef.current = setTimeout(() => {
        setScanResult(null)
        lastScanRef.current = null
      }, 3000)
    } catch {
      setScanResult({
        success: false,
        message: "حدث خطأ في الاتصال",
        subtitle: "يرجى المحاولة مرة أخرى",
      })
    }
  }, [])

  const initializeScanner = useCallback(async () => {
    try {
      // Wait a bit for the DOM element to be available
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const scanner = new Html5Qrcode("qr-reader")
      scannerRef.current = scanner

      // Try to get available cameras
      const cameras = await Html5Qrcode.getCameras()
      
      if (cameras && cameras.length > 0) {
        // Prefer back camera if available
        const backCamera = cameras.find(cam => 
          cam.label.toLowerCase().includes('back') || 
          cam.label.toLowerCase().includes('rear') ||
          cam.label.toLowerCase().includes('environment')
        )
        
        const cameraId = backCamera?.id || cameras[0].id

        await scanner.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 280, height: 280 },
            aspectRatio: 1,
          },
          (decodedText) => {
            handleScan(decodedText)
          },
          () => {} // Ignore errors during scanning
        )
      } else {
        // Fallback to facingMode if no cameras found
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 280, height: 280 },
            aspectRatio: 1,
          },
          (decodedText) => {
            handleScan(decodedText)
          },
          () => {}
        )
      }

      setIsScanning(true)
    } catch (err: unknown) {
      console.error("Scanner error:", err)
      
      // Provide more helpful error messages
      let errorMessage = "فشل في تشغيل الكاميرا"
      
      const error = err as { name?: string; message?: string }
      
      if (error.name === "NotAllowedError" || error.message?.includes("Permission")) {
        errorMessage = "يرجى السماح بالوصول للكاميرا من إعدادات المتصفح"
      } else if (error.name === "NotFoundError" || error.message?.includes("not found")) {
        errorMessage = "لم يتم العثور على كاميرا. تأكد من توصيل الكاميرا"
      } else if (error.name === "NotReadableError" || error.message?.includes("in use")) {
        errorMessage = "الكاميرا قيد الاستخدام من تطبيق آخر"
      } else if (error.name === "OverconstrainedError") {
        errorMessage = "الكاميرا لا تدعم الإعدادات المطلوبة"
      } else if (error.message?.includes("HTTPS")) {
        errorMessage = "يجب استخدام HTTPS للوصول للكاميرا"
      } else if (error.message?.includes("not found")) {
        errorMessage = "تعذر العثور على عنصر الكاميرا"
      }
      
      setError(errorMessage)
      setShowCamera(false)
    } finally {
      setIsInitializing(false)
    }
  }, [handleScan])

  const startScanner = useCallback(async () => {
    setIsInitializing(true)
    setError(null)

    try {
      // Check if we're in a secure context (HTTPS or localhost)
      const isSecureContext = window.isSecureContext || 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1'
      
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!isSecureContext) {
          throw new Error("HTTPS_REQUIRED")
        }
        throw new Error("MEDIA_DEVICES_NOT_SUPPORTED")
      }

      // Check if camera permissions are granted
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      // Stop the stream immediately, we just needed to check permissions
      stream.getTracks().forEach(track => track.stop())

      // Show the camera div first
      setShowCamera(true)
      
    } catch (err: unknown) {
      console.error("Permission error:", err)
      
      const error = err as { name?: string; message?: string }
      
      let errorMessage = "فشل في تشغيل الكاميرا"
      
      if (error.message === "HTTPS_REQUIRED") {
        errorMessage = "يجب استخدام HTTPS للوصول للكاميرا. استخدم رابط آمن (https://)"
      } else if (error.message === "MEDIA_DEVICES_NOT_SUPPORTED") {
        errorMessage = "المتصفح لا يدعم الوصول للكاميرا. جرب متصفح Chrome أو Safari"
      } else if (error.name === "NotAllowedError" || error.message?.includes("Permission")) {
        errorMessage = "يرجى السماح بالوصول للكاميرا من إعدادات المتصفح"
      } else if (error.name === "NotFoundError") {
        errorMessage = "لم يتم العثور على كاميرا. تأكد من توصيل الكاميرا"
      }
      
      setError(errorMessage)
      setIsInitializing(false)
    }
  }, [])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current = null
      } catch (err) {
        console.error("Error stopping scanner:", err)
      }
    }
    setIsScanning(false)
    setShowCamera(false)
  }, [])

  // Initialize scanner when camera div is shown
  useEffect(() => {
    if (showCamera && !isScanning && !error) {
      initializeScanner()
    }
  }, [showCamera, isScanning, error, initializeScanner])

  useEffect(() => {
    return () => {
      stopScanner()
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current)
    }
  }, [stopScanner])

  return (
    <div className="min-h-screen bg-background islamic-pattern-bg flex flex-col" dir="rtl">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-6 shadow-lg">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="rounded-xl bg-primary-foreground/95 px-4 py-2 shadow-md">
            <BrandLogo variant="symbol" className="h-10 sm:h-11 w-auto max-w-[min(100%,320px)]" priority />
          </div>
          <p className="text-sm opacity-90">نظام تسجيل الحضور</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Scanner Area */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {!showCamera && !scanResult && (
                <div className="aspect-square flex flex-col items-center justify-center bg-muted p-6 text-center">
                  {!error ? (
                    <>
                      <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-2">جاهز للمسح</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        اضغط على الزر أدناه لتشغيل الكاميرا
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                      </div>
                      <p className="text-lg font-medium text-destructive mb-2">{error}</p>
                      <div className="text-sm text-muted-foreground mb-4 space-y-1">
                        <p>نصائح لحل المشكلة:</p>
                        <ul className="text-xs list-disc list-inside text-right">
                          <li>تأكد من استخدام HTTPS (رابط آمن)</li>
                          <li>تأكد من السماح بالوصول للكاميرا</li>
                          <li>أغلق التطبيقات الأخرى التي تستخدم الكاميرا</li>
                          <li>جرب استخدام متصفح Chrome أو Safari</li>
                          <li>تأكد من توصيل الكاميرا بشكل صحيح</li>
                        </ul>
                      </div>
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      onClick={startScanner} 
                      disabled={isInitializing}
                      size="lg"
                      variant={error ? "outline" : "default"}
                    >
                      {isInitializing ? (
                        <>
                          <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                          جاري التشغيل...
                        </>
                      ) : error ? (
                        <>
                          <RefreshCw className="ml-2 h-5 w-5" />
                          إعادة المحاولة
                        </>
                      ) : (
                        <>
                          <Camera className="ml-2 h-5 w-5" />
                          تشغيل الكاميرا
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {showCamera && !scanResult && (
                <div className="relative">
                  <div id="qr-reader" className="w-full min-h-[300px]" />
                  <div className="absolute inset-0 pointer-events-none border-4 border-primary/30 rounded-lg">
                    <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  </div>
                </div>
              )}

              {scanResult && (
                <div 
                  className={`aspect-square relative flex flex-col items-center justify-center p-8 text-center transition-all ${
                    scanResult.success 
                      ? "scanner-success animate-success-pulse" 
                      : "scanner-error animate-shake"
                  }`}
                >
                  {/* Confetti on success */}
                  {scanResult.success && <Confetti />}
                  
                  {/* Success/Error Icon with animation */}
                  <div className={`relative w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
                    scanResult.success 
                      ? "bg-linear-to-br from-primary/30 to-primary-accent/30 text-primary" 
                      : "bg-linear-to-br from-destructive/30 to-red-400/30 text-destructive"
                  }`}>
                    {scanResult.success && (
                      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    )}
                    {scanResult.success ? (
                      <CheckCircle className="h-12 w-12 animate-bounce-in" />
                    ) : (
                      <XCircle className="h-12 w-12" />
                    )}
                  </div>
                  
                  {/* Sparkle icons around success */}
                  {scanResult.success && (
                    <>
                      <Sparkles className="absolute top-8 right-8 h-6 w-6 text-primary-accent animate-sparkle" />
                      <Sparkles className="absolute top-12 left-6 h-4 w-4 text-primary animate-sparkle delay-100" />
                      <Sparkles className="absolute bottom-20 right-12 h-5 w-5 text-primary-accent animate-sparkle delay-200" />
                    </>
                  )}
                  
                  <h2 className={`text-2xl font-bold font-arabic mb-2 ${
                    scanResult.success ? "animate-slide-up" : ""
                  }`}>
                    {scanResult.message}
                  </h2>
                  {scanResult.subtitle && (
                    <p className={`text-muted-foreground font-arabic whitespace-pre-line ${
                      scanResult.success ? "animate-slide-up delay-100" : ""
                    }`}>
                      {scanResult.subtitle}
                    </p>
                  )}
                  {scanResult.sessionName && (
                    <p className="mt-4 text-sm text-muted-foreground animate-fade-in">
                      {scanResult.sessionName}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          {showCamera && (
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                onClick={stopScanner}
              >
                <RefreshCw className="ml-2 h-4 w-4" />
                إيقاف الماسح
              </Button>
            </div>
          )}

          {/* Instructions */}
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground font-arabic">
                وجّه الكاميرا نحو رمز QR الخاص بك
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                سيتم تسجيل الحضور تلقائياً
              </p>
            </CardContent>
          </Card>

          {/* Quran Quote */}
          <div className="text-center">
            <p className="text-sm font-arabic text-primary">
              بسم الله الرحمن الرحيم
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ﴿ إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ ﴾
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 text-center text-xs text-muted-foreground">
        جمعية المحافظة على القرآن الكريم - صفاقس
      </footer>
    </div>
  )
}

