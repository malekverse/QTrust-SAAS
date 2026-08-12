/**
 * Scanner Screen
 * Main QR code scanner for attendance check-in
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
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
import { Spacing, BorderRadius, Layout } from '../src/theme/spacing';
import { ScannerFrame, StatusBanner, GeometricPattern } from '../src/components';
import { useDeviceStore } from '../src/store/deviceStore';
import { performCheckIn, CheckInResponse } from '../src/api/attendance';
import { ScannerStatus, ARABIC_MESSAGES } from '../src/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Cooldown between scans of the same QR (ms)
const SCAN_COOLDOWN = 5000;
// Auto-reset delay after success/error
const AUTO_RESET_DELAY = 3000;

export default function ScannerScreen() {
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  
  const { config, canScanQr, setLastScanned, addScanRecord } = useDeviceStore();
  
  const [status, setStatus] = useState<ScannerStatus>('IDLE');
  const [studentName, setStudentName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [settingsLongPressCount, setSettingsLongPressCount] = useState(0);
  
  const isProcessingRef = useRef(false);
  const resetTimeoutRef = useRef<NodeJS.Timeout>();
  const cameraOpacity = useSharedValue(1);

  // Redirect to setup if not configured
  useEffect(() => {
    if (!config.isConfigured) {
      router.replace('/setup');
    }
  }, [config.isConfigured]);

  // Handle settings access (tap logo 5 times)
  const handleLogoPress = () => {
    setSettingsLongPressCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        router.push('/settings');
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
    setErrorMessage('');
    isProcessingRef.current = false;
    cameraOpacity.value = withTiming(1, { duration: 300 });
  }, []);

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
    
    // Clear any existing reset timeout
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    
    try {
      const response: CheckInResponse = await performCheckIn({
        qrUuid,
        scannedAt: new Date().toISOString(),
      });
      
      if (response.success) {
        if (__DEV__) console.log('[Scanner] Check-in success:', response.studentName);
        setStudentName(response.studentName || '');
        setStatus('SUCCESS');
        
        // Add to scan history
        addScanRecord({
          id: Date.now().toString(),
          qrUuid,
          studentName: response.studentName || '',
          sessionName: response.sessionName,
          scannedAt: new Date().toISOString(),
          success: true,
          status: response.status,
          alreadyCheckedIn: response.alreadyCheckedIn,
        });
      } else {
        if (__DEV__) console.log('[Scanner] Check-in failed:', response.message);
        setErrorMessage(response.message || ARABIC_MESSAGES.errorNoSession);
        setStatus('ERROR');
        
        // Add failed scan to history
        addScanRecord({
          id: Date.now().toString(),
          qrUuid,
          studentName: '',
          scannedAt: new Date().toISOString(),
          success: false,
          errorMessage: response.message,
        });
      }
      
      // Auto-reset after delay
      resetTimeoutRef.current = setTimeout(() => {
        resetScanner();
      }, AUTO_RESET_DELAY);
      
    } catch (error: any) {
      if (__DEV__) console.error('[Scanner] Error:', error.message || error.messageAr);
      const errorMsg = error.messageAr || error.message || ARABIC_MESSAGES.errorNetwork;
      setErrorMessage(errorMsg);
      setStatus('ERROR');
      
      // Add error to scan history
      addScanRecord({
        id: Date.now().toString(),
        qrUuid,
        studentName: '',
        scannedAt: new Date().toISOString(),
        success: false,
        errorMessage: errorMsg,
      });
      
      resetTimeoutRef.current = setTimeout(() => {
        resetScanner();
      }, AUTO_RESET_DELAY);
    }
  }, [canScanQr, setLastScanned, addScanRecord, resetScanner]);

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

  // Show full screen result overlay for SUCCESS/ERROR/PROCESSING
  const showResultOverlay = status === 'SUCCESS' || status === 'ERROR' || status === 'PROCESSING';

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      
      {/* Camera View */}
      <Animated.View style={[styles.cameraContainer, cameraAnimatedStyle]}>
        <CameraView
          style={styles.camera}
          facing="front"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={status === 'IDLE' ? handleBarCodeScanned : undefined}
        >
          {/* Overlay */}
          <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)' }]}>
            {/* Top Section - Header */}
            <SafeAreaView style={styles.topSection}>
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
            </SafeAreaView>

            {/* Center Section - Scanner Frame */}
            <View style={styles.centerSection}>
              <ScannerFrame isScanning={status === 'IDLE' || status === 'SCANNING'} />
            </View>

            {/* Bottom Section - Status Banner (only for IDLE) */}
            {!showResultOverlay && (
              <View style={styles.bottomSection}>
                <StatusBanner
                  status={status}
                  studentName={studentName}
                  errorMessage={errorMessage}
                  onScanAnother={handleScanAnother}
                />
              </View>
            )}
          </View>
        </CameraView>
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
          </View>
          <View style={styles.resultContent}>
            <StatusBanner
              status={status}
              studentName={studentName}
              errorMessage={errorMessage}
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
    flex: 1,
  },
  overlay: {
    flex: 1,
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 60,
    paddingBottom: 16,
  },
  resultContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  topSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
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
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
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

