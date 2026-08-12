/**
 * Custom hook for device configuration management
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useDeviceStore, initializeDeviceId } from '../store/deviceStore';
import { isDeviceConfigured } from '../api/client';
import { ENVIRONMENT_PRESETS, DeviceConfig } from '../types';

interface UseDeviceConfigReturn {
  config: DeviceConfig;
  isConfigured: boolean;
  updateConfig: (updates: Partial<DeviceConfig>) => void;
  resetConfig: () => void;
  initDevice: () => Promise<void>;
  getPresetByUrl: (url: string) => typeof ENVIRONMENT_PRESETS[number] | undefined;
}

export function useDeviceConfig(): UseDeviceConfigReturn {
  const { config, setConfig, clearConfig, isSetupComplete } = useDeviceStore();

  const updateConfig = useCallback((updates: Partial<DeviceConfig>) => {
    setConfig(updates);
  }, [setConfig]);

  const resetConfig = useCallback(() => {
    Alert.alert(
      'تأكيد',
      'هل تريد مسح جميع الإعدادات؟',
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
  }, [clearConfig]);

  const initDevice = useCallback(async () => {
    await initializeDeviceId();
  }, []);

  const getPresetByUrl = useCallback((url: string) => {
    return ENVIRONMENT_PRESETS.find(p => p.apiBaseUrl === url);
  }, []);

  return {
    config,
    isConfigured: isSetupComplete(),
    updateConfig,
    resetConfig,
    initDevice,
    getPresetByUrl,
  };
}

export default useDeviceConfig;

