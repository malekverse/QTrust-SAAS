/**
 * Index/Loading Screen
 * Shows while determining initial route
 */

import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../src/theme/ThemeContext';
import { TextStyles } from '../src/theme/typography';
import { Spacing } from '../src/theme/spacing';
import { AyahSeparator } from '../src/components';

export default function IndexScreen() {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View entering={FadeIn.duration(500)} style={styles.content}>
        {/* Logo */}
        <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
          <Ionicons name="book" size={48} color="#fff" />
        </View>
        
        {/* App Name */}
        <Text style={[styles.title, { color: colors.primary }]}>
          جمعية المحافظة على القرآن الكريم
        </Text>
        
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          صفاقس
        </Text>
        
        <AyahSeparator width={120} />
        
        {/* Loading indicator */}
        <ActivityIndicator 
          size="large" 
          color={colors.primary} 
          style={styles.loader}
        />
        
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          جارٍ التحميل...
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...TextStyles.displaySmallArabic,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...TextStyles.h3,
    marginBottom: Spacing.lg,
  },
  loader: {
    marginTop: Spacing.xl,
  },
  loadingText: {
    ...TextStyles.caption,
    marginTop: Spacing.md,
  },
});

