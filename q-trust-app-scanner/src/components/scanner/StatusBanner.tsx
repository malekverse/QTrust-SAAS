/**
 * Status banner component for displaying scan results
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Layout } from '../../theme/spacing';
import { ARABIC_MESSAGES, getRandomSuccessSubtext, ScannerStatus } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface StatusBannerProps {
  status: ScannerStatus;
  studentName?: string;
  errorMessage?: string;
  onScanAnother?: () => void;
}

export function StatusBanner({
  status,
  studentName,
  errorMessage,
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
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          
          <Text style={styles.successGreeting}>
            {ARABIC_MESSAGES.successGreeting(studentName || '')}
          </Text>
          
          <View style={styles.separator}>
            <View style={styles.separatorLineGold} />
            <View style={styles.separatorDotGold} />
            <View style={styles.separatorLineGold} />
          </View>
          
          <Text style={styles.successMessage}>
            {ARABIC_MESSAGES.successMessage}
          </Text>
          
          <Text style={styles.successSubtext}>
            {getRandomSuccessSubtext()}
          </Text>
          
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

  if (status === 'ERROR') {
    return (
      <View style={styles.cardWrapper}>
        <View style={styles.errorCard}>
          <View style={styles.errorIcon}>
            <Ionicons name="close" size={48} color="#fff" />
          </View>
          
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

const styles = StyleSheet.create({
  cardWrapper: {
    width: SCREEN_WIDTH - 48,
    maxWidth: Layout.maxContentWidth,
  },
  
  // IDLE CARD - White solid background
  idleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    // Android shadow
    elevation: 10,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  
  // SUCCESS CARD - Same solid white as idle card
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  
  // ERROR CARD - Same solid white as idle card
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  
  // PROCESSING CARD - Same solid white as idle card
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  
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
