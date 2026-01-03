import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ExtendedUserSettings, Theme, UserSettings } from '../../../types';
import { getJSON, setJSON } from '../../../utils/storage';

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
  const electronBgFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setJSON('ds_settings', settings);
  }, [settings]);

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const resolveTheme = (): Theme =>
      settings.theme === 'system'
        ? mediaQuery.matches
          ? 'dark'
          : 'light'
        : settings.theme;

    const applyTheme = (nextTheme: Theme) => {
      const currentTheme = document.documentElement.getAttribute(
        'data-theme'
      ) as Theme | null;
      if (currentTheme === nextTheme) return;
      const isDarkTheme = nextTheme === 'dark';
      const bgColor = isDarkTheme ? '#0a0a0a' : '#ffffff';
      const root = document.documentElement;

      root.setAttribute('data-theme', nextTheme);
      root.style.backgroundColor = bgColor;
      root.style.colorScheme = isDarkTheme ? 'dark' : 'light';
      document.body.style.backgroundColor = bgColor;

      if (window.electronAPI?.setBackgroundColor) {
        if (electronBgFrameRef.current !== null) {
          cancelAnimationFrame(electronBgFrameRef.current);
        }
        electronBgFrameRef.current = requestAnimationFrame(() => {
          window.electronAPI?.setBackgroundColor?.(bgColor);
          electronBgFrameRef.current = null;
        });
      }
    };

    const handleSystemChange = (event: MediaQueryListEvent) => {
      if (settings.theme === 'system') {
        applyTheme(event.matches ? 'dark' : 'light');
      }
    };

    applyTheme(resolveTheme());
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      if (electronBgFrameRef.current !== null) {
        cancelAnimationFrame(electronBgFrameRef.current);
        electronBgFrameRef.current = null;
      }
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, [settings.theme]);

  return { settings, setSettings };
};
