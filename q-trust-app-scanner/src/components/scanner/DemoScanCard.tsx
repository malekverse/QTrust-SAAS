/**
 * Animated student QR card shown in demo/recording mode. It rises into the
 * scan frame and settles there so the sweeping scan line passes over it —
 * making the capture look like a genuine check-in. Demo-only (the real app
 * shows the live camera instead).
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';

const QR_SOURCE = require('../../../assets/qr/demo-qr.png');

interface DemoScanCardProps {
  size: number;
}

export function DemoScanCard({ size }: DemoScanCardProps) {
  // Card sits comfortably inside the gold scan frame
  const cardWidth = Math.min(size * 0.82, 230);

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        entering={FadeInUp.duration(520).springify().damping(16)}
        exiting={FadeOut.duration(220)}
        style={[styles.card, { width: cardWidth }]}
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="book" size={12} color="#fff" />
          </View>
          <Text style={styles.orgText} numberOfLines={1}>
            بطاقة الحضور
          </Text>
        </View>

        <View style={styles.divider} />

        <Image
          source={QR_SOURCE}
          style={[styles.qr, { width: cardWidth - 40, height: cardWidth - 40 }]}
          contentFit="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    // Android shadow
    elevation: 8,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  logo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#136F4E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#136F4E',
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: '#F4C76C',
    marginBottom: 12,
  },
  qr: {
    borderRadius: 6,
  },
});

export default DemoScanCard;
