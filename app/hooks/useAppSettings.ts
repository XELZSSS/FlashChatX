import { useEffect, useState } from 'react';
import type { ExtendedUserSettings, Theme, UserSettings } from '../../types';
import { getJSON, setJSON } from '../appUtils';

type UseAppSettingsOptions = {
  defaultSettings: UserSettings;
  defaultMemuSettings: ExtendedUserSettings['memu'];
};

export const useAppSettings = ({
  defaultSettings,
  defaultMemuSettings,
}: UseAppSettingsOptions) => {
  const [settings, setSettings] = useState<ExtendedUserSettings>(() => {
    const baseSettings = getJSON<UserSettings>('ds_settings', defaultSettings);
    const memuSettings = getJSON<ExtendedUserSettings['memu']>(
      'ds_memu_config',
      defaultMemuSettings
    );

    return {
      ...baseSettings,
      memu: memuSettings,
    };
  });

  useEffect(() => {
    setJSON('ds_settings', settings);
  }, [settings]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const resolveTheme = (): Theme =>
      settings.theme === 'system'
        ? mediaQuery.matches
          ? 'dark'
          : 'light'
        : settings.theme;

    const applyTheme = (nextTheme: Theme) => {
      const isDarkTheme = nextTheme === 'dark';
      const bgColor = isDarkTheme ? '#0a0a0a' : '#ffffff';

      document.documentElement.setAttribute('data-theme', nextTheme);
      document.documentElement.style.backgroundColor = bgColor;
      document.documentElement.style.colorScheme = isDarkTheme
        ? 'dark'
        : 'light';
      document.body.style.backgroundColor = bgColor;

      window.electronAPI?.setBackgroundColor?.(bgColor);
    };

    const handleSystemChange = (event: MediaQueryListEvent) => {
      if (settings.theme === 'system') {
        applyTheme(event.matches ? 'dark' : 'light');
      }
    };

    applyTheme(resolveTheme());
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, [settings.theme]);

  return { settings, setSettings };
};
