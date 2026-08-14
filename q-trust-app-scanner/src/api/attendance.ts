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
  // Set on failure so callers can distinguish retryable transport errors
  // (NETWORK_ERROR / TIMEOUT / SERVER_ERROR) from definitive rejections.
  errorCode?: string;
}

// Error codes that mean "the server never rejected this scan" — the scan
// can be queued offline and retried later with its original timestamp.
export const RETRYABLE_ERROR_CODES = ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR'] as const;

export function isRetryableCheckInError(errorCode?: string): boolean {
  return !!errorCode && (RETRYABLE_ERROR_CODES as readonly string[]).includes(errorCode);
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
      console.log('[Check-in] Error:', error.code, error.message || error.messageAr || 'Unknown error');
    }

    // Handle API errors - extract Arabic message if available
    const errorMessage = error.messageAr || error.message || 'حدث خطأ أثناء تسجيل الحضور';

    return {
      success: false,
      message: errorMessage,
      errorCode: error.code,
    };
  }
}

export const performCheckIn = checkIn;
