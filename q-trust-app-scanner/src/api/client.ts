/**
 * API Client for Q-Trust App Scanner
 * 
 * Production-ready Axios-based HTTP client for the Q-Trust backend
 * Uses the scanner token from ENV or device config for authentication
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ENV } from '../config/env';
import { useDeviceStore } from '../store/deviceStore';
import { ARABIC_MESSAGES } from '../types';

// Requests flagged `silentErrors` are fire-and-forget telemetry (heartbeat):
// their failures are expected when a kiosk is offline or the endpoint isn't
// deployed yet, so they must not spam the console. Real API calls still log.
declare module 'axios' {
  export interface AxiosRequestConfig {
    silentErrors?: boolean;
  }
}

// Create axios instance with base URL and production-ready settings
const apiClient: AxiosInstance = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 15000, // 15 seconds for production reliability
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor - Add authentication and configure base URL
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { config: deviceConfig } = useDeviceStore.getState();

    // Use device config base URL if configured, otherwise use ENV default
    if (deviceConfig.apiBaseUrl && deviceConfig.apiBaseUrl.length > 0) {
      config.baseURL = deviceConfig.apiBaseUrl;
    }

    // No fallback: an unconfigured device must fail loudly, never borrow
    // a shared credential.
    const token = deviceConfig.deviceToken;
    if (!token || token.length === 0) {
      return Promise.reject({
        code: 'NOT_CONFIGURED',
        message: 'Device is not configured with a scanner token',
        messageAr: ARABIC_MESSAGES.errorNotConfigured,
      });
    }
    config.headers.set(ENV.HEADERS.SCANNER_TOKEN_NAME, token);

    // Identify the device so the backend can track kiosk health per device
    if (deviceConfig.deviceId) {
      config.headers.set(ENV.HEADERS.DEVICE_ID_NAME, deviceConfig.deviceId);
    }

    // Production logging (minimal)
    if (__DEV__ && !config.silentErrors) {
      console.log('[API] Request:', config.method?.toUpperCase(), config.url);
    }

    return config;
  },
  (error) => {
    console.error('[API] Request setup error:', error.message);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle all error scenarios with proper Arabic messages
apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log('[API] Response OK:', response.status);
    }
    return response;
  },
  (error: AxiosError) => {
    // Telemetry (heartbeat) opts out of error logging; failures are expected.
    const silent = Boolean(error.config?.silentErrors);

    // Handle timeout
    if (error.code === 'ECONNABORTED') {
      if (!silent) console.error('[API] Request timed out');
      return Promise.reject({
        code: 'TIMEOUT',
        message: 'Request timed out',
        messageAr: 'انتهت مهلة الطلب. يرجى المحاولة مرة أخرى',
      });
    }

    // Handle network errors (no response received)
    if (!error.response) {
      if (!silent) console.error('[API] Network error:', error.message);
      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: 'Network error - please check your connection',
        messageAr: 'حدث خطأ في الاتصال. تأكد من اتصالك بالإنترنت',
      });
    }

    const responseData = error.response.data as any;
    const status = error.response.status;

    // Extract the Arabic message from the backend response
    // The backend returns { message: "Arabic message here" } for errors
    const backendMessage = responseData?.message;

    if (!silent) console.error('[API] Error response:', status, backendMessage || 'No message');
    
    // Handle specific HTTP status codes
    switch (status) {
      case 400:
        // Bad request - could be validation error or no active session
        return Promise.reject({
          code: 'BAD_REQUEST',
          message: backendMessage || 'Bad request',
          messageAr: backendMessage || 'طلب غير صالح',
          status,
        });
        
      case 401:
        // Unauthorized - invalid scanner token
        return Promise.reject({
          code: 'UNAUTHORIZED',
          message: backendMessage || 'Unauthorized',
          messageAr: backendMessage || 'غير مصرح بالوصول - تحقق من رمز الماسح',
          status,
        });
        
      case 404:
        // Not found - invalid QR code or student not registered
        return Promise.reject({
          code: 'NOT_FOUND',
          message: backendMessage || 'Not found',
          messageAr: backendMessage || 'رمز QR غير صالح أو الطالب غير مسجل',
          status,
        });
        
      case 500:
        // Server error
        return Promise.reject({
          code: 'SERVER_ERROR',
          message: backendMessage || 'Server error',
          messageAr: backendMessage || 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى',
          status,
        });
        
      default:
        // Generic error
        return Promise.reject({
          code: responseData?.code || 'API_ERROR',
          message: backendMessage || 'An error occurred',
          messageAr: backendMessage || 'حدث خطأ',
          status,
        });
    }
  }
);

export interface ApiError {
  code: string;
  message: string;
  messageAr?: string;
  status?: number;
}

export function isNetworkError(error: any): boolean {
  return error?.code === 'NETWORK_ERROR' || error?.code === 'TIMEOUT';
}

export default apiClient;
