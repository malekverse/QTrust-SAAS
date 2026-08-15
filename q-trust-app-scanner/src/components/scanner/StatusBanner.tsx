/**
 * Status banner component for displaying scan results
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Layout } from '../../theme/spacing';
import { ARABIC_MESSAGES, AttendanceStatus, getRandomSuccessSubtext, ScannerStatus } from '../../types';

interface StatusBannerProps {
  status: ScannerStatus;
  studentName?: string;
  errorMessage?: string;
  sessionName?: string;
  attendanceStatus?: AttendanceStatus;
  alreadyCheckedIn?: boolean;
  queuedReason?: 'offline' | 'server';
  onScanAnother?: () => void;
}

function AttendanceChips({
  attendanceStatus,
  alreadyCheckedIn,
}: {
  attendanceStatus?: AttendanceStatus;
  alreadyCheckedIn?: boolean;
}) {
  const chips: { label: string; bg: string; fg: string }[] = [];

  if (alreadyCheckedIn) {
    chips.push({ label: ARABIC_MESSAGES.statusAlready, bg: '#E5E7EB', fg: '#374151' });
  } else if (attendanceStatus === 'LATE') {
    chips.push({ label: ARABIC_MESSAGES.statusLate, bg: '#FEF3C7', fg: '#B45309' });
  } else if (attendanceStatus === 'PRESENT') {
    chips.push({ label: ARABIC_MESSAGES.statusPresent, bg: '#D1FAE5', fg: '#065F46' });
  }

  if (chips.length === 0) return null;

  return (
    <View style={styles.chipRow}>
      {chips.map((chip) => (
        <View key={chip.label} style={[styles.chip, { backgroundColor: chip.bg }]}>
          <Text style={[styles.chipText, { color: chip.fg }]}>{chip.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function StatusBanner({
  status,
  studentName,
  errorMessage,
  sessionName,
  attendanceStatus,
  alreadyCheckedIn,
  queuedReason = 'offline',
  onScanAnother,
}: StatusBannerProps) {

  if (status === 'IDLE' || status === 'SCANNING') {
    return (
      <View style={styles.cardWrapper}>
        <View style={styles.idleCard}>
          <Text style={styles.arabicGreeting}>
            {ARABIC_MESSAGES.greeting}
          </Text>
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <View style={styles.separatorDot} />
            <View style={styles.separatorLine} />
          </View>
          <Text style={styles.subtitle}>
            {ARABIC_MESSAGES.welcomeSubtitle}
          </Text>
          <Text style={styles.scanPrompt}>
            {status === 'SCANNING'
              ? ARABIC_MESSAGES.scanning
              : ARABIC_MESSAGES.scanPrompt}
          </Text>
        </View>
      </View>
    );
  }

  if (status === 'PROCESSING') {
    return (
      <View style={styles.cardWrapper}>
        <View style={styles.processingCard}>
          <View style={styles.processingIndicator}>
            <View style={styles.processingInner} />
          </View>
          <Text style={styles.processingText}>
            {ARABIC_MESSAGES.processing}
          </Text>
        </View>
      </View>
    );
  }

  if (status === 'SUCCESS') {
    return (
      <View style={styles.cardWrapper}>
        <View style={styles.successCard}>
          <Animated.View
            entering={ZoomIn.springify().damping(12).delay(120)}
            style={styles.successIcon}
          >
            <Ionicons name="checkmark" size={48} color="#fff" />
          </Animated.View>

          <Animated.Text entering={FadeInDown.duration(300).delay(220)} style={styles.successGreeting}>
            {ARABIC_MESSAGES.successGreeting(studentName || '')}
          </Animated.Text>

          <AttendanceChips
            attendanceStatus={attendanceStatus}
            alreadyCheckedIn={alreadyCheckedIn}
          />

          {!!sessionName && (
            <Text style={styles.sessionName}>{sessionName}</Text>
          )}

          <View style={styles.separator}>
            <View style={styles.separatorLineGold} />
            <View style={styles.separatorDotGold} />
            <View style={styles.separatorLineGold} />
          </View>

          <Text style={styles.successMessage}>
            {alreadyCheckedIn
              ? ARABIC_MESSAGES.alreadyCheckedIn
              : ARABIC_MESSAGES.successMessage}
          </Text>

          {!alreadyCheckedIn && (
            <Text style={styles.successSubtext}>
              {getRandomSuccessSubtext()}
            </Text>
          )}

          {onScanAnother && (
            <TouchableOpacity
              onPress={onScanAnother}
              style={styles.successButton}
            >
              <Ionicons name="scan" size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {ARABIC_MESSAGES.scanAnother}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (status === 'QUEUED') {
    return (
      <View style={styles.cardWrapper}>
        <View style={styles.queuedCard}>
          <Animated.View
            entering={ZoomIn.springify().damping(12).delay(120)}
            style={styles.queuedIcon}
          >
            <Ionicons name="cloud-offline-outline" size={44} color="#fff" />
          </Animated.View>

          <Text style={styles.queuedTitle}>
            {ARABIC_MESSAGES.queuedTitle}
          </Text>

          <Text style={styles.queuedMessage}>
            {queuedReason === 'server'
              ? ARABIC_MESSAGES.queuedMessageServer
              : ARABIC_MESSAGES.queuedMessageOffline}
          </Text>

          {onScanAnother && (
            <TouchableOpacity
              onPress={onScanAnother}
              style={styles.queuedButton}
            >
              <Ionicons name="scan" size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {ARABIC_MESSAGES.scanAnother}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (status === 'ERROR') {
    return (
      <View style={styles.cardWrapper}>
        <View style={styles.errorCard}>
          <Animated.View
            entering={ZoomIn.springify().damping(12).delay(120)}
            style={styles.errorIcon}
          >
            <Ionicons name="close" size={48} color="#fff" />
          </Animated.View>

          <Text style={styles.errorMessage}>
            {errorMessage || ARABIC_MESSAGES.errorNoSession}
          </Text>

          <Text style={styles.errorSubtext}>
            {ARABIC_MESSAGES.errorContactAdmin}
          </Text>

          {onScanAnother && (
            <TouchableOpacity
              onPress={onScanAnother}
              style={styles.errorButton}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {ARABIC_MESSAGES.retry}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return null;
}

const cardBase = {
  backgroundColor: '#FFFFFF',
  borderRadius: 24,
  padding: 32,
  alignItems: 'center' as const,
  // Android shadow
  elevation: 10,
  // iOS shadow
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 12,
};

const styles = StyleSheet.create({
  cardWrapper: {
    width: '100%',
    maxWidth: Layout.maxContentWidth,
  },

  idleCard: { ...cardBase },
  successCard: { ...cardBase },
  errorCard: { ...cardBase },
  processingCard: { ...cardBase },
  queuedCard: { ...cardBase },

  // Separator
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 200,
    marginVertical: 16,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F4C76C',
  },
  separatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F4C76C',
    marginHorizontal: 8,
  },
  separatorLineGold: {
    flex: 1,
    height: 1,
    backgroundColor: '#F4C76C',
  },
  separatorDotGold: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F4C76C',
    marginHorizontal: 8,
  },

  // Status chips
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 100,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sessionName: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 10,
  },

  // Typography
  arabicGreeting: {
    fontSize: 28,
    fontWeight: '500',
    color: '#136F4E',
    textAlign: 'center',
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 16,
    color: '#1D2939',
    textAlign: 'center',
    lineHeight: 28,
  },
  scanPrompt: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
  },

  // Success styles
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#136F4E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successGreeting: {
    fontSize: 24,
    fontWeight: '500',
    color: '#136F4E',
    textAlign: 'center',
    lineHeight: 36,
  },
  successMessage: {
    fontSize: 20,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 32,
  },
  successSubtext: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 28,
  },
  successButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#136F4E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    marginTop: 24,
    gap: 8,
  },

  // Queued (offline) styles
  queuedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  queuedTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 34,
  },
  queuedMessage: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 28,
  },
  queuedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    marginTop: 24,
    gap: 8,
  },

  // Error styles
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorMessage: {
    fontSize: 20,
    fontWeight: '500',
    color: '#DC2626',
    textAlign: 'center',
    lineHeight: 32,
  },
  errorSubtext: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 28,
  },
  errorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    marginTop: 24,
    gap: 8,
  },

  // Processing styles
  processingIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#136F4E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  processingInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#136F4E',
  },
  processingText: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
  },

  // Button text
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default StatusBanner;
