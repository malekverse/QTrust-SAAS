/**
 * Scanner Screen
 * Main QR code scanner for attendance check-in (kiosk mode)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import * as NavigationBar from 'expo-navigation-bar';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeColors, useTheme } from '../src/theme/ThemeContext';
import { TextStyles } from '../src/theme/typography';
import { Spacing, BorderRadius } from '../src/theme/spacing';
import { ScannerFrame, StatusBanner, GeometricPattern, PinModal } from '../src/components';
import { useDeviceStore } from '../src/store/deviceStore';
import { performCheckIn, isRetryableCheckInError, CheckInResponse } from '../src/api/attendance';
import { useAutoUpdate } from '../src/hooks';
import { feedbackError, feedbackQueued, feedbackSuccess } from '../src/utils/feedback';
import { AttendanceStatus, ScannerStatus, ARABIC_MESSAGES } from '../src/types';

// Cooldown between scans of the same QR (ms)
const SCAN_COOLDOWN = 5000;
// Auto-reset delay after success/error
const AUTO_RESET_DELAY = 3000;

export default function ScannerScreen() {
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [permission, requestPermission] = useCameraPermissions();

  const {
    config,
    cameraFacing,
    hasPin,
    canScanQr,
    setLastScanned,
    addScanRecord,
    enqueuePendingScan,
  } = useDeviceStore();
  const pendingCount = useDeviceStore((s) => s.pendingScans.length);

  const [status, setStatus] = useState<ScannerStatus>('IDLE');
  const [studentName, setStudentName] = useState<string>('');
  const [sessionName, setSessionName] = useState<string>('');
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | undefined>(undefined);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [queuedReason, setQueuedReason] = useState<'offline' | 'server'>('offline');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [settingsLongPressCount, setSettingsLongPressCount] = useState(0);
  const [pinModalVisible, setPinModalVisible] = useState(false);

  const isProcessingRef = useRef(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraOpacity = useSharedValue(1);

  // Kiosk: never let the display sleep while the scanner is up
  useKeepAwake();

  // Kiosk: self-update from EAS when idle (no-op in Expo Go/dev)
  useAutoUpdate(status === 'IDLE');

  // Kiosk: hide the Android navigation bar so students can't swipe out
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    return () => {
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
    };
  }, []);

  // Redirect to setup if not configured
  useEffect(() => {
    if (!config.isConfigured) {
      router.replace('/setup');
    }
  }, [config.isConfigured]);

  // Handle settings access (tap logo 5 times, then PIN if configured)
  const handleLogoPress = () => {
    setSettingsLongPressCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        if (hasPin) {
          setPinModalVisible(true);
        } else {
          router.push('/settings');
        }
        return 0;
      }
      // Reset count after 3 seconds
      setTimeout(() => setSettingsLongPressCount(0), 3000);
      return newCount;
    });
  };

  // Reset scanner state
  const resetScanner = useCallback(() => {
    setStatus('IDLE');
    setStudentName('');
    setSessionName('');
    setAttendanceStatus(undefined);
    setAlreadyCheckedIn(false);
    setErrorMessage('');
    isProcessingRef.current = false;
    cameraOpacity.value = withTiming(1, { duration: 300 });
  }, []);

  const scheduleReset = useCallback((delay: number) => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = setTimeout(() => {
      resetScanner();
    }, delay);
  }, [resetScanner]);

  // Handle QR code scanned
  const handleBarCodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    // Prevent multiple simultaneous scans
    if (isProcessingRef.current) return;

    const qrData = result.data;

    // Extract UUID from QR data (handles raw UUID or URL format)
    let qrUuid = qrData;

    // If it's a URL, extract the UUID from the last path segment
    if (qrData.includes('/')) {
      const parts = qrData.split('/');
      qrUuid = parts[parts.length - 1] || qrData;
    }

    // Remove any query parameters or fragments
    qrUuid = qrUuid.split('?')[0].split('#')[0].trim();

    // Validate that we have a non-empty UUID
    if (!qrUuid || qrUuid.length < 8) {
      if (__DEV__) console.log('[Scanner] Invalid QR data:', qrData.substring(0, 20));
      return;
    }

    // Check cooldown to prevent duplicate scans
    if (!canScanQr(qrUuid, SCAN_COOLDOWN)) {
      if (__DEV__) console.log('[Scanner] Cooldown active for:', qrUuid.substring(0, 8));
      return;
    }

    if (__DEV__) console.log('[Scanner] Processing QR:', qrUuid.substring(0, 8) + '...');

    // Mark as processing
    isProcessingRef.current = true;
    setLastScanned(qrUuid);
    setStatus('PROCESSING');
    cameraOpacity.value = withTiming(0.3, { duration: 200 });

    const scannedAtIso = new Date().toISOString();

    try {
      const response: CheckInResponse = await performCheckIn({
        qrUuid,
        scannedAt: scannedAtIso,
      });

      if (response.success) {
        if (__DEV__) console.log('[Scanner] Check-in success:', response.studentName);
        setStudentName(response.studentName || '');
        setSessionName(response.sessionName || '');
        setAttendanceStatus(response.status);
        setAlreadyCheckedIn(!!response.alreadyCheckedIn);
        setStatus('SUCCESS');
        feedbackSuccess();

        // Add to scan history
        addScanRecord({
          id: Date.now().toString(),
          qrUuid,
          studentName: response.studentName || '',
          sessionName: response.sessionName,
          scannedAt: scannedAtIso,
          success: true,
          status: response.status,
          alreadyCheckedIn: response.alreadyCheckedIn,
        });
      } else if (isRetryableCheckInError(response.errorCode)) {
        // Couldn't complete with the server (offline, timeout, or a transient
        // server/DB error) — keep the scan and sync it later with its original
        // timestamp. The student doesn't wait, and attendance isn't lost.
        if (__DEV__) console.log('[Scanner] Queueing scan for later sync:', response.errorCode);
        // Distinguish "no internet" from "server reachable but erroring" so the
        // banner tells the truth (a 500 is NOT an offline device).
        setQueuedReason(response.errorCode === 'SERVER_ERROR' ? 'server' : 'offline');
        enqueuePendingScan({ qrUuid, scannedAt: scannedAtIso });
        setStatus('QUEUED');
        feedbackQueued();
      } else {
        if (__DEV__) console.log('[Scanner] Check-in failed:', response.message);
        setErrorMessage(response.message || ARABIC_MESSAGES.errorNoSession);
        setStatus('ERROR');
        feedbackError();

        // Add failed scan to history
        addScanRecord({
          id: Date.now().toString(),
          qrUuid,
          studentName: '',
          scannedAt: scannedAtIso,
          success: false,
          errorMessage: response.message,
        });
      }

      scheduleReset(AUTO_RESET_DELAY);
    } catch (error: any) {
      // performCheckIn traps API errors; this only fires on unexpected bugs
      if (__DEV__) console.error('[Scanner] Unexpected error:', error?.message);
      setErrorMessage(error?.messageAr || error?.message || ARABIC_MESSAGES.errorNetwork);
      setStatus('ERROR');
      feedbackError();
      scheduleReset(AUTO_RESET_DELAY);
    }
  }, [canScanQr, setLastScanned, addScanRecord, enqueuePendingScan, scheduleReset]);

  // Manual scan another handler
  const handleScanAnother = () => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    resetScanner();
  };

  // Animated camera style
  const cameraAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cameraOpacity.value,
  }));

  // Permission handling
  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.permissionText, { color: colors.text }]}>
          جارٍ التحميل...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <GeometricPattern opacity={0.03} />
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={colors.primary} />
          <Text style={[styles.permissionTitle, { color: colors.text }]}>
            صلاحية الكاميرا مطلوبة
          </Text>
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
            نحتاج إلى صلاحية الوصول للكاميرا لمسح رموز QR
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: colors.primary }]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>
              السماح بالوصول للكاميرا
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Get current date in Arabic format
  const getCurrentDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return new Date().toLocaleDateString('ar-SA', options);
  };

  const pendingBadge = pendingCount > 0 && (
    <View style={styles.pendingBadge}>
      <Ionicons name="cloud-offline-outline" size={16} color="#B45309" />
      <Text style={styles.pendingBadgeText}>
        {ARABIC_MESSAGES.pendingSyncLabel}: {pendingCount}
      </Text>
    </View>
  );

  // Show full screen result overlay for SUCCESS/ERROR/PROCESSING/QUEUED
  const showResultOverlay =
    status === 'SUCCESS' || status === 'ERROR' || status === 'PROCESSING' || status === 'QUEUED';

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Camera View — CameraView does not support children, so the overlay
          is an absolutely-positioned sibling on top of it. */}
      <Animated.View style={[styles.cameraContainer, cameraAnimatedStyle]}>
        <CameraView
          style={styles.camera}
          facing={cameraFacing}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={status === 'IDLE' ? handleBarCodeScanned : undefined}
        />
        {/* Overlay */}
        <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)' }]}>
            {/* Top Section - Header */}
            <SafeAreaView style={styles.topSection}>
              <View style={styles.headerRow}>
                <TouchableOpacity
                  onPress={handleLogoPress}
                  activeOpacity={0.8}
                  style={styles.headerContainer}
                >
                  <View style={[styles.logoSmall, { backgroundColor: colors.primary }]}>
                    <Ionicons name="book" size={24} color="#fff" />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.appName}>جمعية المحافظة على القرآن</Text>
                    <Text style={styles.dateText}>{getCurrentDate()}</Text>
                  </View>
                </TouchableOpacity>
                {pendingBadge}
              </View>
            </SafeAreaView>

            {/* Content: frame + welcome card side by side in landscape */}
            <View style={[styles.contentArea, isLandscape && styles.contentAreaLandscape]}>
              <View style={styles.centerSection}>
                <ScannerFrame isScanning={status === 'IDLE' || status === 'SCANNING'} />
              </View>

              {!showResultOverlay && (
                <View
                  style={[
                    styles.bottomSection,
                    isLandscape && styles.bottomSectionLandscape,
                  ]}
                >
                  <StatusBanner
                    status={status}
                    studentName={studentName}
                    errorMessage={errorMessage}
                    onScanAnother={handleScanAnother}
                  />
                </View>
              )}
            </View>
        </View>
      </Animated.View>

      {/* RESULT OVERLAY - Rendered OUTSIDE camera for solid background */}
      {showResultOverlay && (
        <View style={styles.resultOverlay}>
          <View style={styles.resultHeader}>
            <View style={[styles.logoSmall, { backgroundColor: colors.primary }]}>
              <Ionicons name="book" size={24} color="#fff" />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.appName, { color: '#136F4E' }]}>جمعية المحافظة على القرآن</Text>
              <Text style={[styles.dateText, { color: '#6B7280' }]}>{getCurrentDate()}</Text>
            </View>
            <View style={styles.resultHeaderSpacer} />
            {pendingBadge}
          </View>
          <View style={styles.resultContent}>
            <StatusBanner
              status={status}
              studentName={studentName}
              errorMessage={errorMessage}
              sessionName={sessionName}
              attendanceStatus={attendanceStatus}
              alreadyCheckedIn={alreadyCheckedIn}
              queuedReason={queuedReason}
              onScanAnother={handleScanAnother}
            />
          </View>
        </View>
      )}

      {/* Settings Hint (appears when close to 5 taps) */}
      {settingsLongPressCount >= 3 && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={styles.settingsHint}
        >
          <Text style={styles.settingsHintText}>
            {5 - settingsLongPressCount} نقرات للإعدادات
          </Text>
        </Animated.View>
      )}

      {/* Settings PIN gate */}
      <PinModal
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
        onSuccess={() => {
          setPinModalVisible(false);
          router.push('/settings');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  // RESULT OVERLAY - Full screen solid background
  resultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8F5F0', // Solid warm off-white background
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 24 : 60,
    paddingBottom: 16,
  },
  resultHeaderSpacer: {
    flex: 1,
  },
  resultContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  topSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? Spacing.md : 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  logoSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: Spacing.md,
  },
  appName: {
    ...TextStyles.h3,
    color: '#fff',
  },
  dateText: {
    ...TextStyles.caption,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 100,
  },
  pendingBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
  },
  contentArea: {
    flex: 1,
  },
  contentAreaLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  bottomSectionLandscape: {
    flex: 1,
    paddingBottom: 0,
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  permissionTitle: {
    ...TextStyles.h2,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  permissionText: {
    ...TextStyles.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  permissionButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  permissionButtonText: {
    ...TextStyles.button,
    color: '#fff',
  },
  settingsHint: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  settingsHintText: {
    ...TextStyles.caption,
    color: '#fff',
  },
});
