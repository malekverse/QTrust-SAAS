/**
 * Attendance API endpoints for Q-Trust backend
 * Production-ready implementation
 */

import apiClient from './client';
import { ENV } from '../config/env';

// Request type for check-in
export interface CheckInRequest {
  qrUuid: string;
  scannedAt?: string; // Optional, ISO 8601 format
}

// Response type from backend - matches backend exactly
export interface CheckInResponse {
  success: boolean;
  studentName?: string;
  sessionName?: string;
  status?: 'PRESENT' | 'LATE' | 'ABSENT' | 'JUSTIFIED_ABSENCE';
  message: string;
  alreadyCheckedIn?: boolean;
}

// Backend error response type
interface BackendErrorResponse {
  message?: string;
}

/**
 * Check in a student using their QR code
 * Calls the real Q-Trust backend
 * 
 * @param request - Check-in request containing qrUuid and optional scannedAt
 * @returns Promise with check-in response
 */
export async function checkIn(request: CheckInRequest): Promise<CheckInResponse> {
  try {
    if (__DEV__) {
      console.log('[Check-in] Sending request for QR:', request.qrUuid.substring(0, 8) + '...');
    }
    
    const response = await apiClient.post<CheckInResponse>(
      ENV.ENDPOINTS.CHECK_IN,
      {
        qrUuid: request.qrUuid,
        scannedAt: request.scannedAt || new Date().toISOString(),
      }
    );
    
    if (__DEV__) {
      console.log('[Check-in] Success:', response.data.studentName);
    }
    
    // Backend returns the complete response directly
    return {
      success: response.data.success ?? true,
      studentName: response.data.studentName,
      sessionName: response.data.sessionName,
      status: response.data.status,
      message: response.data.message || 'تم تسجيل الحضور',
      alreadyCheckedIn: response.data.alreadyCheckedIn,
    };
  } catch (error: any) {
    if (__DEV__) {
      console.log('[Check-in] Error:', error.message || error.messageAr || 'Unknown error');
    }
    
    // Handle API errors - extract Arabic message if available
    const errorMessage = error.messageAr || error.message || 'حدث خطأ أثناء تسجيل الحضور';
    
    return {
      success: false,
      message: errorMessage,
    };
  }
}

/**
 * Mock check-in function for development/testing ONLY
 * Remove or disable in production!
 */
export async function mockCheckIn(request: CheckInRequest): Promise<CheckInResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const uuid = request.qrUuid.toLowerCase();
  
  // Error scenarios for testing
  if (uuid.includes('invalid')) {
    return {
      success: false,
      message: 'رمز QR غير صالح أو الطالب غير مسجل',
    };
  }
  
  if (uuid.includes('nosession')) {
    return {
      success: false,
      message: 'لا توجد حصة نشطة لك في هذا الوقت. يرجى مراجعة الإدارة',
    };
  }
  
  if (uuid.includes('duplicate')) {
    return {
      success: true,
      studentName: 'أحمد محمد',
      sessionName: 'حفظ القرآن - المجموعة أ',
      message: 'تم تسجيل حضورك مسبقاً',
      alreadyCheckedIn: true,
    };
  }
  
  // Success scenario
  const names = [
    'أحمد محمد',
    'عمر عبدالله',
    'يوسف علي',
    'إبراهيم حسن',
    'خالد أحمد',
    'زيد محمود',
    'حمزة عثمان',
    'بلال ياسر',
  ];
  
  const randomName = names[Math.floor(Math.random() * names.length)];
  const isLate = Math.random() > 0.7; // 30% chance of being late
  
  return {
    success: true,
    studentName: randomName,
    sessionName: 'حفظ القرآن - المجموعة أ',
    status: isLate ? 'LATE' : 'PRESENT',
    message: isLate ? 'تم تسجيل حضورك بنجاح (متأخر)' : 'تم تسجيل حضورك بنجاح',
  };
}

// ============================================
// SWITCH THIS TO USE REAL API:
// Change 'mockCheckIn' to 'checkIn' below
// ============================================
export const performCheckIn = checkIn; // NOW USING REAL API!
