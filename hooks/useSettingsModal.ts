import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import type { ProviderType } from '../types';
import { ExtendedUserSettings, MemuSettings, ToolChoiceMode } from '../types';
import {
  loadProviderConfig,
  saveProviderConfig,
  ProviderConfig,
  getProviderConfigForProvider,
} from '../services/config/providerConfig';
import { saveMemuConfig } from '../services/config/memuService';
import {
  normalizeToolConfig,
  isProviderConfigEqual,
  normalizeDecimalInput,
  parseDecimalInput,
  parseIntegerInput,
} from '../utils/configUtils';

interface UseSettingsModalProps {
  settings: ExtendedUserSettings;
  onUpdateSettings: (newSettings: ExtendedUserSettings) => void;
  onClose: () => void;
  modalTransitionMs: number;
}

export const useSettingsModal = ({
  settings,
  onUpdateSettings,
  onClose,
  modalTransitionMs,
}: UseSettingsModalProps) => {
  const isMountedRef = useRef(true);
  const saveTimerRef = useRef<number | null>(null);
  const openAICompatibleApiUrlRef = useRef<string | undefined>();

  // Provider configuration state
  const [initialConfig] = useState<ProviderConfig>(() => loadProviderConfig());

  const [initialProviderSnapshot, setInitialProviderSnapshot] =
    useState<ProviderConfig>(initialConfig);
  const [providerConfig, setProviderConfig] =
    useState<ProviderConfig>(initialConfig);

  // MemU configuration state
  const [memuConfig, setMemuConfig] = useState<MemuSettings>(settings.memu);

  // Input states for controlled inputs
  const [temperatureInput, setTemperatureInput] = useState(
    String(initialConfig.temperature ?? 0)
  );
  const [topPInput, setTopPInput] = useState(
    initialConfig.topP !== undefined ? String(initialConfig.topP) : ''
  );
  const [topKInput, setTopKInput] = useState(
    initialConfig.topK !== undefined ? String(initialConfig.topK) : ''
  );
  const [thinkingBudgetInput, setThinkingBudgetInput] = useState(
    initialConfig.thinkingBudgetTokens !== undefined
      ? String(initialConfig.thinkingBudgetTokens)
      : ''
  );

  // Check if configuration has changed
  const hasProviderChanged = useMemo(
    () => !isProviderConfigEqual(providerConfig, initialProviderSnapshot),
    [providerConfig, initialProviderSnapshot]
  );

  const hasMemuChanged = useMemo(
    () =>
      memuConfig.enabled !== settings.memu.enabled ||
      memuConfig.apiKey !== settings.memu.apiKey ||
      memuConfig.baseUrl !== settings.memu.baseUrl ||
      memuConfig.autoSave !== settings.memu.autoSave ||
      memuConfig.maxMemories !== settings.memu.maxMemories,
    [memuConfig, settings.memu]
  );

  // Provider handlers
  useEffect(() => {
    openAICompatibleApiUrlRef.current = initialConfig.apiUrl;
  }, [initialConfig.apiUrl]);

  const handleApiKeyChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setProviderConfig(prev => ({ ...prev, apiKey: e.target.value }));
  }, []);

  const handleClearApiKey = useCallback(() => {
    setProviderConfig(prev => ({ ...prev, apiKey: '' }));
  }, []);

  const handleModelChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setProviderConfig(prev => ({ ...prev, model: e.target.value }));
  }, []);

  const handleTemperatureChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = normalizeDecimalInput(e.target.value);
      setTemperatureInput(value);
      const parsed = parseDecimalInput(value);
      setProviderConfig(prev => ({
        ...prev,
        temperature: parsed ?? 0,
      }));
    },
    []
  );

  const handleTopPChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = normalizeDecimalInput(e.target.value);
    setTopPInput(value);
    const parsed = parseDecimalInput(value);
    setProviderConfig(prev => ({
      ...prev,
      topP: parsed,
    }));
  }, []);

  const handleTopKChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setTopKInput(value);
    const parsed = parseIntegerInput(value);
    setProviderConfig(prev => ({
      ...prev,
      topK: parsed,
    }));
  }, []);

  const handleThinkingBudgetChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9]/g, '');
      setThinkingBudgetInput(value);
      const parsed = parseIntegerInput(value);
      setProviderConfig(prev => ({
        ...prev,
        thinkingBudgetTokens: parsed,
      }));
    },
    []
  );

  const handleApiUrlChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setProviderConfig(prev => ({ ...prev, apiUrl: value }));
    openAICompatibleApiUrlRef.current = value;
  }, []);

  const handleProviderChange = useCallback(
    (provider: ProviderType) => {
      setProviderConfig(prev => {
        const next = getProviderConfigForProvider(provider);
        const preservedApiUrl =
          next.apiUrl ||
          prev.apiUrl ||
          openAICompatibleApiUrlRef.current ||
          initialConfig.apiUrl ||
          '';

        if (provider === 'openai-compatible') {
          openAICompatibleApiUrlRef.current = preservedApiUrl;
        }

        setTemperatureInput(String(next.temperature ?? 0));
        setTopPInput(next.topP !== undefined ? String(next.topP) : '');
        setTopKInput(next.topK !== undefined ? String(next.topK) : '');
        setThinkingBudgetInput(
          next.thinkingBudgetTokens !== undefined
            ? String(next.thinkingBudgetTokens)
            : ''
        );

        return {
          ...next,
          apiUrl:
            provider === 'openai-compatible' ? preservedApiUrl : undefined,
        };
      });
    },
    [initialConfig.apiUrl]
  );

  const handleToggleStreaming = useCallback(() => {
    setProviderConfig(prev => ({ ...prev, stream: !prev.stream }));
  }, []);

  const handleToggleAdvancedParams = useCallback(() => {
    setProviderConfig(prev => ({
      ...prev,
      showAdvancedParams: !prev.showAdvancedParams,
    }));
  }, []);

  // Tool configuration handlers
  const handleToggleTool = useCallback((toolName: string) => {
    setProviderConfig(prev => {
      const base = normalizeToolConfig(prev.toolConfig);
      const enabled = base.enabledToolNames.includes(toolName)
        ? base.enabledToolNames.filter(name => name !== toolName)
        : [...base.enabledToolNames, toolName];
      return {
        ...prev,
        toolConfig: {
          ...base,
          enabledToolNames: enabled,
        },
      };
    });
  }, []);

  const handleToolChoiceChange = useCallback((value: ToolChoiceMode) => {
    setProviderConfig(prev => {
      const base = normalizeToolConfig(prev.toolConfig);
      return {
        ...prev,
        toolConfig: {
          ...base,
          toolChoice: value,
          toolChoiceName: value === 'specific' ? base.toolChoiceName : '',
        },
      };
    });
  }, []);

  const handleToolChoiceNameChange = useCallback((value: string) => {
    setProviderConfig(prev => {
      const base = normalizeToolConfig(prev.toolConfig);
      return {
        ...prev,
        toolConfig: {
          ...base,
          toolChoiceName: value,
        },
      };
    });
  }, []);

  // MemU handlers
  const handleMemuConfigChange = useCallback(
    (field: keyof MemuSettings, value: MemuSettings[keyof MemuSettings]) => {
      setMemuConfig(prev => {
        const newMemuConfig = { ...prev, [field]: value };
        onUpdateSettings({ ...settings, memu: newMemuConfig });
        return newMemuConfig;
      });
    },
    [settings, onUpdateSettings]
  );

  // Save handlers
  const saveConfigOnClose = useCallback(
    async (config: ProviderConfig) => {
      if (isProviderConfigEqual(config, initialProviderSnapshot)) {
        return true;
      }

      try {
        const success = await saveProviderConfig(config);
        if (success && isMountedRef.current) {
          setInitialProviderSnapshot({ ...config });
          console.log('Configuration saved successfully');
        } else if (!success) {
          console.error('Failed to save configuration');
        }
        return success;
      } catch (error) {
        console.error('Error saving config:', error);
        return false;
      }
    },
    [initialProviderSnapshot]
  );

  const handleSaveMemuConfig = useCallback(async () => {
    try {
      const success = await saveMemuConfig(memuConfig);
      if (success) {
        console.log('MemU configuration saved successfully');
      } else {
        console.error('Failed to save MemU configuration');
      }
    } catch (error) {
      console.error('Error saving MemU config:', error);
    }
  }, [memuConfig]);

  const handleClose = useCallback(async () => {
    onClose();

    if (hasProviderChanged || hasMemuChanged) {
      const providerSnapshot = providerConfig;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void (async () => {
          if (hasProviderChanged) {
            await saveConfigOnClose(providerSnapshot);
          }
          if (hasMemuChanged) {
            await handleSaveMemuConfig();
          }
        })();
      }, modalTransitionMs);
    }
  }, [
    handleSaveMemuConfig,
    hasMemuChanged,
    hasProviderChanged,
    modalTransitionMs,
    onClose,
    providerConfig,
    saveConfigOnClose,
  ]);

  return {
    // State
    providerConfig,
    memuConfig,
    temperatureInput,
    topPInput,
    topKInput,
    thinkingBudgetInput,
    hasProviderChanged,
    hasMemuChanged,

    // Provider handlers
    handleApiKeyChange,
    handleClearApiKey,
    handleModelChange,
    handleTemperatureChange,
    handleTopPChange,
    handleTopKChange,
    handleThinkingBudgetChange,
    handleApiUrlChange,
    handleProviderChange,
    handleToggleStreaming,
    handleToggleAdvancedParams,

    // Tool handlers
    handleToggleTool,
    handleToolChoiceChange,
    handleToolChoiceNameChange,

    // MemU handlers
    handleMemuConfigChange,

    // Close handler
    handleClose,
  };
};
