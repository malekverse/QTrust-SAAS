# 📱 Mobile App Integration Documentation

## Q-Trust Attendance System - QR Scanner Mobile App

This document contains everything needed to build the mobile/tablet QR scanner application for the Quran Association attendance system.

---

## 🎯 Purpose of the Mobile App

The mobile app has **ONE main purpose**: Scan student QR codes and mark them as present in their assigned class.

### Flow Summary
1. Student shows their QR code (printed card or phone)
2. Tablet/phone camera scans the QR code
3. App sends the QR UUID to the backend
4. Backend validates and records attendance
5. App displays success/error message with student name

---

## 🔐 Authentication

The mobile scanner uses a **static device token** (not user login).

### Token Configuration
```
Header: x-scanner-token
Value: <SCANNER_DEVICE_TOKEN from environment>
Default (development): dev-scanner-token
```

### Environment Variable
On the backend, set:
```env
SCANNER_DEVICE_TOKEN=your-secure-token-here
```

On the mobile app, configure:
```env
SCANNER_TOKEN=your-secure-token-here
```

> ⚠️ **Important**: Use a strong, unique token in production!

---

## 📡 API Endpoint

### POST `/api/attendance/check-in`

This is the **only endpoint** the mobile app needs to call.

#### Request

```http
POST /api/attendance/check-in
Content-Type: application/json
x-scanner-token: your-scanner-token-here

{
  "qrUuid": "550e8400-e29b-41d4-a716-446655440000",
  "scannedAt": "2025-12-09T14:30:00.000Z"  // Optional, ISO 8601 format
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `qrUuid` | string | ✅ Yes | The UUID encoded in the student's QR code |
| `scannedAt` | string | ❌ No | ISO 8601 timestamp of scan (defaults to server time if omitted) |

#### Success Response (200 OK)

```json
{
  "success": true,
  "studentName": "أحمد محمد",
  "sessionName": "حفظ القرآن - المجموعة أ",
  "status": "PRESENT",
  "message": "تم تسجيل حضورك بنجاح"
}
```

Or if student arrives late:
```json
{
  "success": true,
  "studentName": "أحمد محمد",
  "sessionName": "حفظ القرآن - المجموعة أ",
  "status": "LATE",
  "message": "تم تسجيل حضورك بنجاح (متأخر)"
}
```

Or if already checked in:
```json
{
  "success": true,
  "studentName": "أحمد محمد",
  "sessionName": "حفظ القرآن - المجموعة أ",
  "message": "تم تسجيل حضورك مسبقاً",
  "alreadyCheckedIn": true
}
```

#### Error Responses

**401 Unauthorized** - Invalid scanner token
```json
{
  "message": "غير مصرح بالوصول"
}
```

**400 Bad Request** - Validation error
```json
{
  "message": "رمز QR مطلوب"
}
```

**404 Not Found** - Invalid QR code
```json
{
  "message": "رمز QR غير صالح أو الطالب غير مسجل"
}
```

**400 Bad Request** - Student not enrolled in any session
```json
{
  "message": "لم يتم تسجيلك في أي حصة. يرجى مراجعة الإدارة"
}
```

**400 Bad Request** - No active session at this time
```json
{
  "message": "لا توجد حصة نشطة لك في هذا الوقت. يرجى مراجعة الإدارة"
}
```

**500 Internal Server Error**
```json
{
  "message": "حدث خطأ أثناء تسجيل الحضور"
}
```

---

## 📊 Data Models Reference

### QR Code Content

The QR code contains a **UUID string only**:
```
550e8400-e29b-41d4-a716-446655440000
```

This is stored in the `qrUuid` field of the Student model. Each student has a **unique, permanent** QR UUID.

### Attendance Status Values

```typescript
const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',           // On time
  ABSENT: 'ABSENT',             // Did not attend
  LATE: 'LATE',                 // Arrived after threshold
  JUSTIFIED_ABSENCE: 'JUSTIFIED_ABSENCE'  // Excused absence
}
```

### Session Status Values

```typescript
const SESSION_STATUS = {
  SCHEDULED: 'SCHEDULED',       // Not started yet
  IN_PROGRESS: 'IN_PROGRESS',   // Currently active
  FINISHED: 'FINISHED',         // Completed
  CANCELLED: 'CANCELLED'        // Cancelled
}
```

---

## ⏰ Time Window Logic

The system enforces when QR scanning is allowed:

### Default Settings (configurable per session)
```typescript
const DEFAULT_QR_SETTINGS = {
  openOffsetBeforeMin: 15,   // QR opens 15 min BEFORE session starts
  closeOffsetAfterMin: 20,   // QR closes 20 min AFTER session ends
  lateThresholdMin: 10       // Student marked LATE if >10 min after start
}
```

### Example Timeline
For a session from **14:00 to 15:00**:
- **QR Opens**: 13:45 (15 min before)
- **Session Starts**: 14:00
- **Late After**: 14:10 (10 min grace period)
- **Session Ends**: 15:00
- **QR Closes**: 15:20 (20 min after)

Scans outside the QR window will return:
```json
{
  "message": "لا توجد حصة نشطة لك في هذا الوقت. يرجى مراجعة الإدارة"
}
```

---

## 🛡️ Anti-Cheating Features

The backend automatically handles:

1. **Time Window Enforcement**: QR codes only work during allowed times
2. **Duplicate Prevention**: Same student can't check in twice to same session
3. **Session Assignment**: Student must be assigned to the class to check in
4. **Active Status**: Only active students can check in

---

## 📱 Mobile App Implementation Guide

### Recommended Tech Stack
- **React Native** with Expo (cross-platform)
- **Flutter** (cross-platform)
- **Native iOS** (Swift) or **Native Android** (Kotlin)

### Required Features

#### 1. QR Scanner
- Camera access for scanning
- Continuous scanning mode
- Auto-focus and lighting support
- Handle various QR code sizes

#### 2. Network Communication
- POST requests to check-in endpoint
- Handle all response scenarios
- Offline detection (show "no connection" message)

#### 3. UI/UX Requirements
- Large, clear success/error messages
- Student name prominently displayed on success
- Auto-reset after 3 seconds
- Arabic RTL layout
- Islamic-inspired design (green/gold colors)

### Sample React Native Code

```typescript
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';

const API_URL = 'https://your-domain.com';
const SCANNER_TOKEN = 'your-scanner-token';

interface CheckInResult {
  success: boolean;
  studentName?: string;
  sessionName?: string;
  status?: string;
  message: string;
  alreadyCheckedIn?: boolean;
}

export default function QRScanner() {
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);

  const handleScan = useCallback(async (qrUuid: string) => {
    // Prevent duplicate scans
    if (lastScanned === qrUuid) return;
    setLastScanned(qrUuid);

    try {
      const response = await fetch(`${API_URL}/api/attendance/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-scanner-token': SCANNER_TOKEN,
        },
        body: JSON.stringify({
          qrUuid,
          scannedAt: new Date().toISOString(),
        }),
      });

      const data: CheckInResult = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          studentName: data.studentName,
          sessionName: data.sessionName,
          status: data.status,
          message: `مرحبًا يا ${data.studentName}`,
        });
      } else {
        setResult({
          success: false,
          message: data.message || 'حدث خطأ',
        });
      }

      // Reset after 3 seconds
      setTimeout(() => {
        setResult(null);
        setLastScanned(null);
      }, 3000);

    } catch (error) {
      setResult({
        success: false,
        message: 'حدث خطأ في الاتصال',
      });
    }
  }, [lastScanned]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    handleScan(data);
  };

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />
      
      {result && (
        <View style={[
          styles.resultOverlay,
          result.success ? styles.success : styles.error
        ]}>
          <Text style={styles.resultText}>{result.message}</Text>
          {result.success && result.sessionName && (
            <Text style={styles.sessionText}>{result.sessionName}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  resultOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    alignItems: 'center',
  },
  success: {
    backgroundColor: 'rgba(19, 111, 78, 0.95)',
  },
  error: {
    backgroundColor: 'rgba(220, 38, 38, 0.95)',
  },
  resultText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sessionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
});
```

### Sample Flutter Code

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:mobile_scanner/mobile_scanner.dart';

class QRScannerScreen extends StatefulWidget {
  @override
  _QRScannerScreenState createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends State<QRScannerScreen> {
  static const apiUrl = 'https://your-domain.com';
  static const scannerToken = 'your-scanner-token';
  
  String? lastScanned;
  Map<String, dynamic>? result;

  Future<void> handleScan(String qrUuid) async {
    if (lastScanned == qrUuid) return;
    setState(() => lastScanned = qrUuid);

    try {
      final response = await http.post(
        Uri.parse('$apiUrl/api/attendance/check-in'),
        headers: {
          'Content-Type': 'application/json',
          'x-scanner-token': scannerToken,
        },
        body: jsonEncode({
          'qrUuid': qrUuid,
          'scannedAt': DateTime.now().toUtc().toIso8601String(),
        }),
      );

      final data = jsonDecode(response.body);

      setState(() {
        if (response.statusCode == 200) {
          result = {
            'success': true,
            'studentName': data['studentName'],
            'sessionName': data['sessionName'],
            'message': 'مرحبًا يا ${data['studentName']}',
          };
        } else {
          result = {
            'success': false,
            'message': data['message'] ?? 'حدث خطأ',
          };
        }
      });

      // Reset after 3 seconds
      Future.delayed(Duration(seconds: 3), () {
        if (mounted) {
          setState(() {
            result = null;
            lastScanned = null;
          });
        }
      });

    } catch (e) {
      setState(() {
        result = {
          'success': false,
          'message': 'حدث خطأ في الاتصال',
        };
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          MobileScanner(
            onDetect: (capture) {
              final barcode = capture.barcodes.first;
              if (barcode.rawValue != null) {
                handleScan(barcode.rawValue!);
              }
            },
          ),
          if (result != null)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: EdgeInsets.all(24),
                color: result!['success'] 
                    ? Color(0xFF136F4E).withOpacity(0.95)
                    : Colors.red.withOpacity(0.95),
                child: Column(
                  children: [
                    Text(
                      result!['message'],
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                      textDirection: TextDirection.rtl,
                    ),
                    if (result!['sessionName'] != null)
                      Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Text(
                          result!['sessionName'],
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 16,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
```

---

## 🎨 Design Guidelines

### Color Palette (Islamic Theme)
```css
--primary: #136F4E        /* Deep Islamic green */
--primary-accent: #F4C76C /* Warm gold */
--background: #FAF8F5     /* Warm off-white */
--text: #1A1A1A           /* Near black */
--muted: #6B7280          /* Gray for secondary text */
--success: #22C55E        /* Bright green for success */
--error: #DC2626          /* Red for errors */
```

### Typography
- Arabic text: Use "Noto Sans Arabic" or "Cairo" font
- Support RTL (Right-to-Left) layout

### UI Messages (Arabic)

| Scenario | Message |
|----------|---------|
| Success | `مرحبًا يا [اسم الطالب]` |
| Success subtitle | `تم تسجيل حضورك بنجاح ✅` |
| Success (late) | `تم تسجيل حضورك بنجاح (متأخر)` |
| Already checked in | `تم تسجيل حضورك مسبقاً` |
| Invalid QR | `رمز QR غير صالح أو الطالب غير مسجل` |
| No session | `لا توجد حصة نشطة لك في هذا الوقت` |
| Not enrolled | `لم يتم تسجيلك في أي حصة` |
| Contact admin | `يرجى مراجعة الإدارة` |
| Connection error | `حدث خطأ في الاتصال` |

### Islamic Blessing Messages (Optional)
```
زادك الله حرصًا على كتابه
بارك الله فيك
جزاك الله خيراً
```

---

## 🧪 Testing

### Test QR Codes
Create test students in the admin panel and generate their QR codes. Each QR contains a UUID like:
```
550e8400-e29b-41d4-a716-446655440000
```

### Test Scenarios to Cover
1. ✅ Valid scan during active session
2. ✅ Valid scan but student is late
3. ✅ Already checked in (duplicate scan)
4. ❌ Invalid QR UUID
5. ❌ Valid student but no active session
6. ❌ Valid student but not enrolled in any session
7. ❌ Scan outside time window
8. ❌ Invalid scanner token
9. ❌ Network connection error

---

## 🚀 Deployment Checklist

### Backend
- [ ] Set `SCANNER_DEVICE_TOKEN` environment variable
- [ ] Ensure API is accessible over HTTPS
- [ ] Configure CORS to allow mobile app requests

### Mobile App
- [ ] Configure API base URL
- [ ] Configure scanner token
- [ ] Test camera permissions
- [ ] Test on actual devices (not just emulators)
- [ ] Test Arabic text rendering
- [ ] Test RTL layout
- [ ] Test offline behavior

---

## 📞 Support

For issues with the backend API or questions about integration, contact the development team.

---

**Last Updated**: December 2025  
**API Version**: 1.0
