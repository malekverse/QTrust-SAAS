/**
 * Custom Button component with Islamic design
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../../theme/colors';
import { TextStyles } from '../../theme/typography';
import { BorderRadius, Spacing, Layout, Shadows } from '../../theme/spacing';
import { useThemeColors } from '../../theme/ThemeContext';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: disabled ? colors.grayLight : colors.primary,
            ...Shadows.md,
          },
          text: {
            color: Colors.white,
          },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: disabled ? colors.grayLighter : colors.accent,
            ...Shadows.sm,
          },
          text: {
            color: colors.black,
          },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderColor: disabled ? colors.grayLight : colors.primary,
          },
          text: {
            color: disabled ? colors.grayLight : colors.primary,
          },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: {
            color: disabled ? colors.grayLight : colors.primary,
          },
        };
      default:
        return { container: {}, text: {} };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            height: Layout.buttonHeightSmall,
            paddingHorizontal: Spacing.md,
          },
          text: TextStyles.buttonSmall,
        };
      case 'lg':
        return {
          container: {
            height: Layout.buttonHeightLarge,
            paddingHorizontal: Spacing.xl,
          },
          text: {
            ...TextStyles.button,
            fontSize: 18,
          },
        };
      default:
        return {
          container: {
            height: Layout.buttonHeight,
            paddingHorizontal: Spacing.lg,
          },
          text: TextStyles.button,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.container,
        sizeStyles.container,
        variantStyles.container,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? Colors.white : colors.primary}
          size="small"
        />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text
            style={[
              styles.text,
              sizeStyles.text,
              variantStyles.text,
              icon && styles.textWithIcon,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
  },
  text: {
    textAlign: 'center',
  },
  textWithIcon: {
    marginLeft: Spacing.xs,
  },
});

export default Button;

