/**
 * PIN entry modal guarding the settings screen.
 * The hash it verifies against lives in SecureStore (see utils/secureStorage).
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useThemeColors } from '../../theme/ThemeContext';
import { BorderRadius, Spacing } from '../../theme/spacing';
import { TextStyles } from '../../theme/typography';
import { ARABIC_MESSAGES } from '../../types';
import { verifyPin } from '../../utils/secureStorage';

interface PinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PinModal({ visible, onClose, onSuccess }: PinModalProps) {
  const colors = useThemeColors();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const reset = () => {
    setPin('');
    setError('');
    setChecking(false);
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  const handleConfirm = async () => {
    if (checking) return;
    setChecking(true);
    const ok = await verifyPin(pin);
    if (ok) {
      reset();
      onSuccess();
    } else {
      setPin('');
      setError(ARABIC_MESSAGES.pinWrong);
      setChecking(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="lock-closed" size={28} color="#fff" />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {ARABIC_MESSAGES.pinEnterPrompt}
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: error ? colors.error : colors.border,
                backgroundColor: colors.background,
              },
            ]}
            value={pin}
            onChangeText={(v) => {
              setPin(v.replace(/[^0-9]/g, ''));
              if (error) setError('');
            }}
            placeholder={ARABIC_MESSAGES.pinPlaceholder}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            autoFocus
            onSubmitEditing={handleConfirm}
          />

          {!!error && (
            <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={handleCancel}
              style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.buttonLabel, { color: colors.textSecondary }]}>
                {ARABIC_MESSAGES.cancel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={pin.length < 4 || checking}
              style={[
                styles.button,
                {
                  backgroundColor: pin.length < 4 || checking ? colors.grayLight : colors.primary,
                },
              ]}
            >
              <Text style={[styles.buttonLabel, { color: '#fff' }]}>
                {ARABIC_MESSAGES.confirm}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...TextStyles.body,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 6,
  },
  error: {
    ...TextStyles.caption,
    marginTop: Spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    width: '100%',
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  buttonLabel: {
    ...TextStyles.button,
  },
});

export default PinModal;
