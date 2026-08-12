/**
 * Custom hook for handling QR scan operations
 * Production-ready implementation
 */

import { useState, useCallback, useRef } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import { performCheckIn, CheckInResponse } from '../api/attendance';
import { ScannerStatus, ScanRecord, ARABIC_MESSAGES } from '../types';

interface UseScanHandlerOptions {
  cooldownMs?: number;
  autoResetDelayMs?: number;
  onSuccess?: (response: CheckInResponse) => void;
  onError?: (error: any) => void;
}

interface UseScanHandlerReturn {
  status: ScannerStatus;
  studentName: string;
  errorMessage: string;
  handleScan: (qrData: string) => Promise<void>;
  reset: () => void;
  isProcessing: boolean;
}

export function useScanHandler(options: UseScanHandlerOptions = {}): UseScanHandlerReturn {
  const {
    cooldownMs = 5000,
    autoResetDelayMs = 3000,
    onSuccess,
    onError,
  } = options;

  const { canScanQr, setLastScanned, addScanRecord } = useDeviceStore();
  
  const [status, setStatus] = useState<ScannerStatus>('IDLE');
  const [studentName, setStudentName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const isProcessingRef = useRef(false);
  const resetTimeoutRef = useRef<NodeJS.Timeout>();

  const reset = useCallback(() => {
    setStatus('IDLE');
    setStudentName('');
    setErrorMessage('');
    isProcessingRef.current = false;
    
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = undefined;
    }
  }, []);

  const handleScan = useCallback(async (qrData: string) => {
    // Prevent multiple simultaneous scans
    if (isProcessingRef.current) return;
    
    // Extract UUID from QR data (handles both raw UUID and URL format)
    let qrUuid = qrData;
    if (qrData.includes('/')) {
      const parts = qrData.split('/');
      qrUuid = parts[parts.length - 1] || qrData;
    }
    
    // Remove any query parameters or fragments
    qrUuid = qrUuid.split('?')[0].split('#')[0];
    
    // Check cooldown to prevent duplicate scans
    if (!canScanQr(qrUuid, cooldownMs)) {
      if (__DEV__) console.log('[ScanHandler] Cooldown active for QR:', qrUuid.substring(0, 8));
      return;
    }
    
    // Start processing
    isProcessingRef.current = true;
    setLastScanned(qrUuid);
    setStatus('PROCESSING');
    
    // Clear any existing reset timeout
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    
    try {
      // Call the check-in API
      const response: CheckInResponse = await performCheckIn({
        qrUuid,
        scannedAt: new Date().toISOString(),
      });
      
      if (response.success) {
        // Success - extract student name from response
        const name = response.studentName || '';
        setStudentName(name);
        setStatus('SUCCESS');
        
        // Add to scan history
        addScanRecord({
          id: Date.now().toString(),
          qrUuid,
          studentName: name,
          sessionName: response.sessionName,
          scannedAt: new Date().toISOString(),
          success: true,
          status: response.status,
          alreadyCheckedIn: response.alreadyCheckedIn,
        });
        
        onSuccess?.(response);
      } else {
        // Error from backend - use the message
        const error = response.message || ARABIC_MESSAGES.errorNoSession;
        setErrorMessage(error);
        setStatus('ERROR');
        
        // Add failed scan to history
        addScanRecord({
          id: Date.now().toString(),
          qrUuid,
          studentName: '',
          scannedAt: new Date().toISOString(),
          success: false,
          errorMessage: error,
        });
        
        onError?.(error);
      }
      
      // Schedule auto-reset
      resetTimeoutRef.current = setTimeout(() => {
        reset();
      }, autoResetDelayMs);
      
    } catch (error: any) {
      // Network or unexpected error
      const errorMsg = error.messageAr || error.message || ARABIC_MESSAGES.errorNetwork;
      setErrorMessage(errorMsg);
      setStatus('ERROR');
      
      addScanRecord({
        id: Date.now().toString(),
        qrUuid,
        studentName: '',
        scannedAt: new Date().toISOString(),
        success: false,
        errorMessage: errorMsg,
      });
      
      onError?.(error);
      
      resetTimeoutRef.current = setTimeout(() => {
        reset();
      }, autoResetDelayMs);
    }
  }, [canScanQr, cooldownMs, autoResetDelayMs, setLastScanned, addScanRecord, onSuccess, onError, reset]);

  return {
    status,
    studentName,
    errorMessage,
    handleScan,
    reset,
    isProcessing: isProcessingRef.current,
  };
}

export default useScanHandler;

