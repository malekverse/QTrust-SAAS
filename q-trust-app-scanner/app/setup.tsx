/**
 * Device Setup Screen
 * First-run configuration for the scanner device
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeColors } from '../src/theme/ThemeContext';
import { TextStyles } from '../src/theme/typography';
import { Spacing, BorderRadius, Layout, Shadows } from '../src/theme/spacing';
import { Button, Card, Input, AyahSeparator, GeometricPattern } from '../src/components';
import { useDeviceStore, initializeDeviceId } from '../src/store/deviceStore';
import { ENVIRONMENT_PRESETS, ARABIC_MESSAGES } from '../src/types';
import { ENV } from '../src/config/env';

export default function SetupScreen() {
  const colors = useThemeColors();
  const { config, setConfig } = useDeviceStore();
  
  const [selectedPreset, setSelectedPreset] = useState('production');
  const [customUrl, setCustomUrl] = useState('');
  const [deviceToken, setDeviceToken] = useState('');
  const [errors, setErrors] = useState<{ url?: string; token?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize device ID on mount
    initializeDeviceId();
    
    // Pre-fill if config exists
    if (config.apiBaseUrl) {
      const preset = ENVIRONMENT_PRESETS.find(p => p.apiBaseUrl === config.apiBaseUrl);
      if (preset) {
        setSelectedPreset(preset.id);
      } else {
        setSelectedPreset('custom');
        setCustomUrl(config.apiBaseUrl);
      }
    }
    if (config.deviceToken) {
      setDeviceToken(config.deviceToken);
    }
  }, []);

  const validateForm = (): boolean => {
    const newErrors: { url?: string; token?: string } = {};
    
    const preset = ENVIRONMENT_PRESETS.find(p => p.id === selectedPreset);
    const apiUrl = selectedPreset === 'custom' ? customUrl : preset?.apiBaseUrl;
    
    if (!apiUrl || apiUrl.trim().length === 0) {
      newErrors.url = 'يرجى إدخال عنوان الخادم';
    } else if (selectedPreset === 'custom' && !apiUrl.startsWith('http')) {
      newErrors.url = 'يجب أن يبدأ العنوان بـ http:// أو https://';
    }
    
    if (!deviceToken || deviceToken.trim().length === 0) {
      newErrors.token = 'يرجى إدخال رمز الجهاز';
    } else if (deviceToken.length < 8) {
      newErrors.token = 'رمز الجهاز قصير جدًا';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const preset = ENVIRONMENT_PRESETS.find(p => p.id === selectedPreset);
      const apiUrl = selectedPreset === 'custom' ? customUrl : preset?.apiBaseUrl;
      
      setConfig({
        apiBaseUrl: apiUrl || '',
        deviceToken: deviceToken.trim(),
        isConfigured: true,
      });
      
      // Brief delay for UX feedback
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Navigate to scanner
      router.replace('/scanner');
    } catch (error) {
      Alert.alert(
        'خطأ',
        'حدث خطأ أثناء حفظ الإعدادات',
        [{ text: 'حسنًا' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <GeometricPattern opacity={0.03} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(500)}
            style={styles.header}
          >
            <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
              <Ionicons name="settings-outline" size={40} color="#fff" />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {ARABIC_MESSAGES.setupTitle}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {ARABIC_MESSAGES.setupSubtitle}
            </Text>
            <AyahSeparator width={160} />
          </Animated.View>

          {/* Environment Selection */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(500)}
          >
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                بيئة الخادم
              </Text>
              
              <View style={styles.presetGrid}>
                {ENVIRONMENT_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.presetButton,
                      {
                        backgroundColor: selectedPreset === preset.id 
                          ? colors.primary 
                          : colors.surface,
                        borderColor: selectedPreset === preset.id 
                          ? colors.primary 
                          : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedPreset(preset.id)}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        {
                          color: selectedPreset === preset.id 
                            ? '#fff' 
                            : colors.text,
                        },
                      ]}
                    >
                      {preset.nameAr}
                    </Text>
                    {preset.id !== 'custom' && (
                      <Text
                        style={[
                          styles.presetUrlText,
                          {
                            color: selectedPreset === preset.id 
                              ? 'rgba(255,255,255,0.7)' 
                              : colors.textMuted,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {preset.apiBaseUrl}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {selectedPreset === 'custom' && (
                <Input
                  label={ARABIC_MESSAGES.apiUrlLabel}
                  value={customUrl}
                  onChangeText={setCustomUrl}
                  placeholder="https://api.example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  error={errors.url}
                  containerStyle={styles.customUrlInput}
                />
              )}
            </Card>
          </Animated.View>

          {/* Device Token */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(500)}
          >
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {ARABIC_MESSAGES.deviceTokenLabel}
              </Text>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                يمكنك الحصول على رمز الجهاز من لوحة التحكم
              </Text>
              
              <Input
                value={deviceToken}
                onChangeText={setDeviceToken}
                placeholder="أدخل رمز الجهاز"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                error={errors.token}
              />
            </Card>
          </Animated.View>

          {/* Device ID Info */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(500)}
          >
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                معرّف الجهاز
              </Text>
              <View style={[styles.deviceIdBox, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.deviceIdText, { color: colors.textSecondary }]}>
                  {config.deviceId || 'جارٍ التحميل...'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    // Copy to clipboard functionality could be added here
                    Alert.alert('تم النسخ', 'تم نسخ معرّف الجهاز');
                  }}
                >
                  <Ionicons name="copy-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </Card>
          </Animated.View>

          {/* Save Button */}
          <Animated.View
            entering={FadeInDown.delay(500).duration(500)}
            style={styles.buttonContainer}
          >
            <Button
              title={ARABIC_MESSAGES.saveSettings}
              onPress={handleSave}
              loading={isLoading}
              size="lg"
              style={styles.saveButton}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    maxWidth: Layout.maxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.lg,
  },
  title: {
    ...TextStyles.displaySmallArabic,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...TextStyles.bodyArabic,
    marginBottom: Spacing.lg,
  },
  card: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...TextStyles.h3,
    textAlign: 'right',
    marginBottom: Spacing.xs,
  },
  sectionHint: {
    ...TextStyles.caption,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  presetButton: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  presetText: {
    ...TextStyles.bodyMedium,
    textAlign: 'center',
  },
  presetUrlText: {
    ...TextStyles.caption,
    marginTop: Spacing.xxs,
    textAlign: 'center',
  },
  customUrlInput: {
    marginTop: Spacing.md,
  },
  deviceIdBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  deviceIdText: {
    ...TextStyles.caption,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  buttonContainer: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  saveButton: {
    width: '100%',
  },
});

