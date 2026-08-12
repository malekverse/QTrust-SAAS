/**
 * Settings Screen
 * Update device configuration and theme settings
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeColors } from '../src/theme/ThemeContext';
import { TextStyles } from '../src/theme/typography';
import { Spacing, BorderRadius, Layout, Shadows } from '../src/theme/spacing';
import { Button, Card, Input, AyahSeparator, GeometricPattern } from '../src/components';
import { useDeviceStore } from '../src/store/deviceStore';
import { ThemeMode, ARABIC_MESSAGES, ENVIRONMENT_PRESETS } from '../src/types';

const THEME_OPTIONS: { id: ThemeMode; label: string; icon: string }[] = [
  { id: 'light', label: ARABIC_MESSAGES.lightMode, icon: 'sunny' },
  { id: 'dark', label: ARABIC_MESSAGES.darkMode, icon: 'moon' },
  { id: 'system', label: ARABIC_MESSAGES.systemMode, icon: 'phone-portrait' },
];

export default function SettingsScreen() {
  const colors = useThemeColors();
  const { 
    config, 
    themeMode, 
    setConfig, 
    setThemeMode, 
    clearConfig,
    recentScans,
    clearRecentScans,
  } = useDeviceStore();
  
  const [deviceToken, setDeviceToken] = useState(config.deviceToken);
  const [selectedPreset, setSelectedPreset] = useState(() => {
    const preset = ENVIRONMENT_PRESETS.find(p => p.apiBaseUrl === config.apiBaseUrl);
    return preset?.id || 'custom';
  });
  const [customUrl, setCustomUrl] = useState(
    ENVIRONMENT_PRESETS.find(p => p.apiBaseUrl === config.apiBaseUrl) 
      ? '' 
      : config.apiBaseUrl
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleSaveConfig = async () => {
    const preset = ENVIRONMENT_PRESETS.find(p => p.id === selectedPreset);
    const apiUrl = selectedPreset === 'custom' ? customUrl : preset?.apiBaseUrl;
    
    if (!apiUrl || !deviceToken) {
      Alert.alert('خطأ', 'يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    
    setIsSaving(true);
    
    try {
      setConfig({
        apiBaseUrl: apiUrl,
        deviceToken: deviceToken.trim(),
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      Alert.alert('تم الحفظ', 'تم حفظ الإعدادات بنجاح', [
        { text: 'حسنًا', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearConfig = () => {
    Alert.alert(
      'تأكيد',
      'هل تريد مسح جميع الإعدادات؟ سيتم إعادة توجيهك إلى صفحة الإعداد.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'مسح',
          style: 'destructive',
          onPress: () => {
            clearConfig();
            router.replace('/setup');
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      'تأكيد',
      'هل تريد مسح سجل المسح؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'مسح',
          style: 'destructive',
          onPress: clearRecentScans,
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <GeometricPattern opacity={0.03} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {ARABIC_MESSAGES.settingsTitle}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Theme Selection */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {ARABIC_MESSAGES.themeLabel}
            </Text>
            
            <View style={styles.themeOptions}>
              {THEME_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: themeMode === option.id 
                        ? colors.primary 
                        : colors.surface,
                      borderColor: themeMode === option.id 
                        ? colors.primary 
                        : colors.border,
                    },
                  ]}
                  onPress={() => setThemeMode(option.id)}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={24}
                    color={themeMode === option.id ? '#fff' : colors.text}
                  />
                  <Text
                    style={[
                      styles.themeOptionText,
                      { color: themeMode === option.id ? '#fff' : colors.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* Server Configuration */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              إعدادات الخادم
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
                      { color: selectedPreset === preset.id ? '#fff' : colors.text },
                    ]}
                  >
                    {preset.nameAr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedPreset === 'custom' && (
              <Input
                label="عنوان الخادم المخصص"
                value={customUrl}
                onChangeText={setCustomUrl}
                placeholder="https://api.example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                containerStyle={styles.customUrlInput}
              />
            )}
          </Card>
        </Animated.View>

        {/* Device Token */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              رمز الجهاز
            </Text>
            
            <Input
              value={deviceToken}
              onChangeText={setDeviceToken}
              placeholder="أدخل رمز الجهاز"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            
            <Button
              title="حفظ الإعدادات"
              onPress={handleSaveConfig}
              loading={isSaving}
              style={styles.saveButton}
            />
          </Card>
        </Animated.View>

        {/* Device Info */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              معلومات الجهاز
            </Text>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                معرّف الجهاز
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>
                {config.deviceId}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                عدد عمليات المسح
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {recentScans.length}
              </Text>
            </View>
            
            {recentScans.length > 0 && (
              <TouchableOpacity
                onPress={handleClearHistory}
                style={[styles.clearButton, { borderColor: colors.error }]}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={[styles.clearButtonText, { color: colors.error }]}>
                  مسح السجل
                </Text>
              </TouchableOpacity>
            )}
          </Card>
        </Animated.View>

        {/* Recent Scans (Debug) */}
        {recentScans.length > 0 && (
          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                آخر عمليات المسح
              </Text>
              
              {recentScans.slice(0, 5).map((scan) => (
                <View
                  key={scan.id}
                  style={[
                    styles.scanItem,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View style={styles.scanItemLeft}>
                    <Ionicons
                      name={scan.success ? 'checkmark-circle' : 'close-circle'}
                      size={20}
                      color={scan.success ? colors.success : colors.error}
                    />
                    <View style={styles.scanItemText}>
                      <Text style={[styles.scanName, { color: colors.text }]}>
                        {scan.studentName || 'غير معروف'}
                      </Text>
                      <Text style={[styles.scanTime, { color: colors.textMuted }]}>
                        {new Date(scan.scannedAt).toLocaleTimeString('ar-SA')}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </Animated.View>
        )}

        {/* Danger Zone */}
        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <Card style={[styles.card, { borderColor: colors.error }]}>
            <Text style={[styles.sectionTitle, { color: colors.error }]}>
              منطقة الخطر
            </Text>
            
            <Button
              title="إعادة تعيين الجهاز"
              onPress={handleClearConfig}
              variant="outline"
              style={[styles.dangerButton, { borderColor: colors.error }]}
              textStyle={{ color: colors.error }}
            />
          </Card>
        </Animated.View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    ...TextStyles.h2,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    padding: Spacing.lg,
    maxWidth: Layout.maxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...TextStyles.h3,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  themeOptionText: {
    ...TextStyles.caption,
    marginTop: Spacing.xs,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
    ...TextStyles.bodySmall,
    textAlign: 'center',
  },
  customUrlInput: {
    marginTop: Spacing.md,
  },
  saveButton: {
    marginTop: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    ...TextStyles.bodySmall,
  },
  infoValue: {
    ...TextStyles.bodySmall,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
    textAlign: 'left',
    marginLeft: Spacing.md,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  clearButtonText: {
    ...TextStyles.buttonSmall,
  },
  scanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  scanItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanItemText: {
    marginLeft: Spacing.sm,
  },
  scanName: {
    ...TextStyles.bodySmall,
  },
  scanTime: {
    ...TextStyles.caption,
  },
  dangerButton: {
    backgroundColor: 'transparent',
  },
  bottomPadding: {
    height: Spacing.xxl,
  },
});

