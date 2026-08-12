/**
 * Text Input component with Islamic design
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BorderRadius, Spacing, Layout } from '../../theme/spacing';
import { TextStyles } from '../../theme/typography';
import { useThemeColors } from '../../theme/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  containerStyle,
  ...props
}: InputProps) {
  const colors = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);
  const borderColor = useSharedValue(colors.border);

  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: borderColor.value,
  }));

  const handleFocus = () => {
    setIsFocused(true);
    borderColor.value = withTiming(colors.primary, { duration: 200 });
  };

  const handleBlur = () => {
    setIsFocused(false);
    borderColor.value = withTiming(
      error ? colors.error : colors.border,
      { duration: 200 }
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}
      <Animated.View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : colors.border,
          },
          isFocused && styles.inputFocused,
          animatedBorder,
        ]}
      >
        <TextInput
          style={[
            styles.input,
            { color: colors.text },
            props.style,
          ]}
          placeholderTextColor={colors.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
      </Animated.View>
      {error && (
        <Text style={[styles.error, { color: colors.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...TextStyles.bodySmall,
    fontWeight: '500',
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xxs,
  },
  inputContainer: {
    height: Layout.inputHeight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  inputFocused: {
    borderWidth: 2,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    ...TextStyles.body,
  },
  error: {
    ...TextStyles.caption,
    marginTop: Spacing.xxs,
    marginLeft: Spacing.xxs,
  },
});

export default Input;

