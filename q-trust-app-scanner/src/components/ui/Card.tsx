/**
 * Card component with Islamic design
 */

import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { BorderRadius, Spacing, Layout, Shadows } from '../../theme/spacing';
import { useThemeColors } from '../../theme/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  animated?: boolean;
  animationDelay?: number;
}

export function Card({
  children,
  style,
  elevated = false,
  animated = true,
  animationDelay = 0,
}: CardProps) {
  const colors = useThemeColors();
  
  const Container = animated ? Animated.View : View;
  
  return (
    <Container
      entering={animated ? FadeInUp.delay(animationDelay).duration(400) : undefined}
      style={[
        styles.card,
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
        },
        elevated && Shadows.lg,
        !elevated && Shadows.sm,
        style,
      ]}
    >
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    padding: Layout.cardPadding,
    borderWidth: 1,
  },
});

export default Card;

