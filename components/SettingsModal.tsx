// Hooks
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
// Icons
import {
  X,
  User,
  Settings as SettingsIcon,
  Info,
  Monitor,
  Moon,
  Sun,
  Cloud,
  Brain,
  Calculator,
  Wrench,
} from 'lucide-react';
// Types
import type { ProviderType } from '../types';
import {
  Theme,
  ExtendedUserSettings,
  MemuSettings,
  ToolChoiceMode,
} from '../types';
// Constants
import { SUPPORTED_LANGUAGES } from '../constants';
// Contexts
import { useTranslation } from '../contexts/useTranslation';
// Services
import {
  loadProviderConfig,
  saveProviderConfig,
  ProviderConfig,
  getDefaultModelForProvider,
  getProviderConfigForProvider,
} from '../services/providerConfig';
import { saveMemuConfig } from '../services/memuService';
import {
  listTools,
  getDefaultToolConfig,
  ToolDefinition,
} from '../services/toolRegistry';
// Components
import AboutTab from './settings/tabs/AboutTab';
import DataTab from './settings/tabs/DataTab';
import GeneralTab from './settings/tabs/GeneralTab';
import MemoryTab from './settings/tabs/MemoryTab';
import ProviderTab from './settings/tabs/ProviderTab';
import ToolsTab from './settings/tabs/ToolsTab';

interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly settings: ExtendedUserSettings;
  readonly onUpdateSettings: (newSettings: ExtendedUserSettings) => void;
}

type SettingsTabId =
  | 'general'
  | 'provider'
  | 'tools'
  | 'memory'
  | 'profile'
  | 'data'
  | 'about';
type TabIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const sanitizeNumber = (value: string) => value.replace(/[^0-9.]/g, '');
const normalizeDecimalInput = (value: string) => {
  const sanitized = sanitizeNumber(value);
  const parts = sanitized.split('.');
  if (parts.length <= 1) return sanitized;
  return `${parts[0]}.${parts.slice(1).join('')}`;
};

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const { t } = useTranslation();
  const [initialConfig] = useState<ProviderConfig>(() => loadProviderConfig());
  const isMountedRef = useRef(true);
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const modalTransitionMs = 180;

  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');
  const [dropdownStates, setDropdownStates] = useState({
    language: false,
    provider: false,
    toolChoice: false,
  });

  const languageRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<HTMLDivElement>(null);
  const toolChoiceRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = useCallback((key: keyof typeof dropdownStates) => {
    setDropdownStates(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const closeDropdown = useCallback((key: keyof typeof dropdownStates) => {
    setDropdownStates(prev => ({ ...prev, [key]: false }));
  }, []);

  // Click outside handler
  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      const target = event.target as Node;
      if (languageRef.current && !languageRef.current.contains(target)) {
        closeDropdown('language');
      }
      if (providerRef.current && !providerRef.current.contains(target)) {
        closeDropdown('provider');
      }
      if (toolChoiceRef.current && !toolChoiceRef.current.contains(target)) {
        closeDropdown('toolChoice');
      }
    },
    [closeDropdown]
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      openTimerRef.current = window.setTimeout(() => {
        setIsVisible(true);
        setIsClosing(false);
      }, 0);
      return () => {
        if (openTimerRef.current) {
          window.clearTimeout(openTimerRef.current);
          openTimerRef.current = null;
        }
      };
    }

    if (!isVisible) return;
    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(true);
    }, 0);
    hideTimerRef.current = window.setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
    }, modalTransitionMs);

    return () => {
      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [isOpen, isVisible, isClosing]);

  useEffect(() => {
    if (
      dropdownStates.language ||
      dropdownStates.provider ||
      dropdownStates.toolChoice
    ) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    dropdownStates.language,
    dropdownStates.provider,
    dropdownStates.toolChoice,
    handleClickOutside,
  ]);

  const tabs = useMemo<
    ReadonlyArray<{
      id: SettingsTabId;
      label: string;
      icon: TabIcon;
    }>
  >(
    () => [
      { id: 'general', label: t('general'), icon: SettingsIcon },
      { id: 'provider', label: t('providerSettings'), icon: Cloud },
      { id: 'tools', label: t('toolPermissionsTab'), icon: Wrench },
      { id: 'memory', label: t('memorySettings'), icon: Brain },
      { id: 'data', label: t('data'), icon: Calculator },
      { id: 'profile', label: t('profile'), icon: User },
      { id: 'about', label: t('about'), icon: Info },
    ],
    [t]
  );

  const themeOptions = useMemo(
    () => [
      { value: 'light' as Theme, label: t('light'), icon: Sun },
      { value: 'dark' as Theme, label: t('dark'), icon: Moon },
      { value: 'system' as Theme, label: t('system'), icon: Monitor },
    ],
    [t]
  );

  const [initialProviderSnapshot, setInitialProviderSnapshot] =
    useState<ProviderConfig>(initialConfig);
  const [providerConfig, setProviderConfig] =
    useState<ProviderConfig>(initialConfig);
  const openAICompatibleApiUrlRef = useRef<string | undefined>(
    initialConfig.apiUrl
  );

  // MemU configuration state
  const [memuConfig, setMemuConfig] = useState<MemuSettings>(settings.memu);

  // Token calculator state
  const [tokenInput, setTokenInput] = useState('');
  const [charInput, setCharInput] = useState('');
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
  const toolOptions = useMemo<ToolDefinition[]>(() => listTools(), []);
  const toolChoiceOptions = useMemo(
    () => [
      { id: 'auto' as ToolChoiceMode, label: t('toolChoiceAuto') },
      { id: 'none' as ToolChoiceMode, label: t('toolChoiceNone') },
      { id: 'required' as ToolChoiceMode, label: t('toolChoiceRequired') },
      { id: 'specific' as ToolChoiceMode, label: t('toolChoiceSpecific') },
    ],
    [t]
  );
  const [calculationMode, setCalculationMode] = useState<
    'tokenToChar' | 'charToToken'
  >('tokenToChar');
  const normalizeToolConfig = useCallback(
    (config?: ProviderConfig['toolConfig']) => {
      const fallback = getDefaultToolConfig();
      return {
        enabledToolNames: config?.enabledToolNames || fallback.enabledToolNames,
        toolChoice: config?.toolChoice || fallback.toolChoice,
        toolChoiceName: config?.toolChoiceName || '',
      };
    },
    []
  );

  const isToolConfigEqual = useCallback(
    (a?: ProviderConfig['toolConfig'], b?: ProviderConfig['toolConfig']) => {
      const left = normalizeToolConfig(a);
      const right = normalizeToolConfig(b);
      if (left.toolChoice !== right.toolChoice) return false;
      if (left.toolChoiceName !== right.toolChoiceName) return false;
      if (left.enabledToolNames.length !== right.enabledToolNames.length) {
        return false;
      }
      const leftSorted = [...left.enabledToolNames].sort();
      const rightSorted = [...right.enabledToolNames].sort();
      return leftSorted.every((name, idx) => name === rightSorted[idx]);
    },
    [normalizeToolConfig]
  );

  const providerOptions = useMemo(
    () =>
      [
        { id: 'openai' as const, label: t('openai') },
        { id: 'mimo' as const, label: t('mimo') },
        { id: 'z' as const, label: t('z') },
        { id: 'z-intl' as const, label: t('zIntl') },
        { id: 'deepseek' as const, label: t('deepseek') },
        { id: 'openai-compatible' as const, label: t('openaiCompatible') },
        { id: 'bailing' as const, label: t('bailing') },
        { id: 'longcat' as const, label: t('longcat') },
        { id: 'modelscope' as const, label: t('modelscope') },
        { id: 'moonshot' as const, label: t('moonshot') },
        { id: 'minimax' as const, label: t('minimax') },
        { id: 'google' as const, label: t('google') },
        { id: 'anthropic' as const, label: t('anthropic') },
      ].sort((a, b) => a.label.length - b.label.length) as Array<{
        id: ProviderType;
        label: string;
      }>,
    [t]
  );

  const advancedParamSupport = useMemo(
    () => ({
      openai: { topP: true, topK: false },
      'openai-compatible': { topP: true, topK: true },
      mimo: { topP: true, topK: true },
      z: { topP: true, topK: true },
      'z-intl': { topP: true, topK: true },
      deepseek: { topP: true, topK: true },
      bailing: { topP: true, topK: true },
      longcat: { topP: true, topK: true },
      modelscope: { topP: true, topK: true },
      moonshot: { topP: true, topK: true },
      minimax: { topP: true, topK: true },
      google: { topP: true, topK: true },
      anthropic: { topP: true, topK: true },
    }),
    []
  );

  const activeAdvancedSupport =
    advancedParamSupport[providerConfig.provider] || null;
  const supportsAdvancedParams = !!activeAdvancedSupport;

  const activeProviderLabel = useMemo(() => {
    return (
      providerOptions.find(option => option.id === providerConfig.provider)
        ?.label ?? t('provider')
    );
  }, [providerOptions, providerConfig.provider, t]);
  const activeToolChoiceLabel = useMemo(() => {
    const choice = normalizeToolConfig(providerConfig.toolConfig).toolChoice;
    return toolChoiceOptions.find(option => option.id === choice)?.label || '';
  }, [normalizeToolConfig, providerConfig.toolConfig, toolChoiceOptions]);

  // Auto-save configuration when dialog closes
  const saveConfigOnClose = useCallback(
    async (config: ProviderConfig) => {
      const hasChanged =
        config.provider !== initialProviderSnapshot.provider ||
        config.apiKey !== initialProviderSnapshot.apiKey ||
        config.model !== initialProviderSnapshot.model ||
        config.stream !== initialProviderSnapshot.stream ||
        config.apiUrl !== initialProviderSnapshot.apiUrl ||
        config.temperature !== initialProviderSnapshot.temperature ||
        config.topP !== initialProviderSnapshot.topP ||
        config.topK !== initialProviderSnapshot.topK ||
        config.showAdvancedParams !==
          initialProviderSnapshot.showAdvancedParams ||
        config.thinkingBudgetTokens !==
          initialProviderSnapshot.thinkingBudgetTokens ||
        config.showThinkingSummary !==
          initialProviderSnapshot.showThinkingSummary ||
        !isToolConfigEqual(
          config.toolConfig,
          initialProviderSnapshot.toolConfig
        );

      if (!hasChanged) return true;

      try {
        const success = await saveProviderConfig(config);
        if (success) {
          if (isMountedRef.current) {
            setInitialProviderSnapshot({ ...config });
          }
          console.log('Configuration saved successfully');
        } else {
          console.error('Failed to save configuration');
        }
        return success;
      } catch (error) {
        console.error('Error saving config:', error);
        return false;
      }
    },
    [initialProviderSnapshot, isToolConfigEqual]
  );

  // Enhanced input handlers
  const handleApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setProviderConfig(prev => ({ ...prev, apiKey: value }));
    },
    []
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setProviderConfig(prev => ({ ...prev, model: value }));
    },
    []
  );

  const handleTemperatureChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = normalizeDecimalInput(e.target.value);
      setTemperatureInput(value);
      const parsed =
        value === '.' || value.endsWith('.') ? NaN : parseFloat(value);
      if (Number.isFinite(parsed)) {
        setProviderConfig(prev => ({ ...prev, temperature: parsed }));
      } else if (!value) {
        setProviderConfig(prev => ({ ...prev, temperature: 0 }));
      }
    },
    []
  );

  const handleTopPChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = normalizeDecimalInput(e.target.value);
      setTopPInput(value);
      const parsed =
        value === '.' || value.endsWith('.') ? NaN : parseFloat(value);
      if (Number.isFinite(parsed)) {
        setProviderConfig(prev => ({ ...prev, topP: parsed }));
      } else if (!value) {
        setProviderConfig(prev => ({ ...prev, topP: undefined }));
      }
    },
    []
  );

  const handleTopKChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9]/g, '');
      setTopKInput(value);
      const parsed = value ? parseInt(value, 10) : NaN;
      if (Number.isFinite(parsed)) {
        setProviderConfig(prev => ({ ...prev, topK: parsed }));
      } else if (!value) {
        setProviderConfig(prev => ({ ...prev, topK: undefined }));
      }
    },
    []
  );

  const handleThinkingBudgetChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9]/g, '');
      setThinkingBudgetInput(value);
      const parsed = value ? parseInt(value, 10) : NaN;
      if (Number.isFinite(parsed)) {
        setProviderConfig(prev => ({ ...prev, thinkingBudgetTokens: parsed }));
      } else if (!value) {
        setProviderConfig(prev => ({
          ...prev,
          thinkingBudgetTokens: undefined,
        }));
      }
    },
    []
  );

  const handleApiUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setProviderConfig(prev => ({ ...prev, apiUrl: value }));
      openAICompatibleApiUrlRef.current = value;
    },
    []
  );

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
      closeDropdown('provider');
    },
    [closeDropdown, initialConfig.apiUrl]
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

  const handleToggleThinkingSummary = useCallback(() => {
    setProviderConfig(prev => ({
      ...prev,
      showThinkingSummary: !prev.showThinkingSummary,
    }));
  }, []);

  const handleToggleTool = useCallback(
    (toolName: string) => {
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
    },
    [normalizeToolConfig]
  );

  const handleToolChoiceChange = useCallback(
    (value: ToolChoiceMode) => {
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
    },
    [normalizeToolConfig]
  );

  const handleToolChoiceNameChange = useCallback(
    (value: string) => {
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
    },
    [normalizeToolConfig]
  );

  // Handler to clear API key
  const handleClearApiKey = useCallback(() => {
    setProviderConfig(prev => ({ ...prev, apiKey: '' }));
  }, []);

  // Memoized language switching handler
  const handleLanguageChange = useCallback(
    (language: string) => {
      onUpdateSettings({ ...settings, language });
    },
    [settings, onUpdateSettings]
  );

  // Memoized theme switching handler
  const handleThemeChange = useCallback(
    (theme: Theme) => {
      onUpdateSettings({ ...settings, theme });
    },
    [settings, onUpdateSettings]
  );

  // MemU configuration handlers
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

  const hasProviderChanged = useMemo(() => {
    return (
      providerConfig.provider !== initialProviderSnapshot.provider ||
      providerConfig.apiKey !== initialProviderSnapshot.apiKey ||
      providerConfig.model !== initialProviderSnapshot.model ||
      providerConfig.stream !== initialProviderSnapshot.stream ||
      providerConfig.apiUrl !== initialProviderSnapshot.apiUrl ||
      providerConfig.temperature !== initialProviderSnapshot.temperature ||
      providerConfig.topP !== initialProviderSnapshot.topP ||
      providerConfig.topK !== initialProviderSnapshot.topK ||
      providerConfig.showAdvancedParams !==
        initialProviderSnapshot.showAdvancedParams ||
      providerConfig.thinkingBudgetTokens !==
        initialProviderSnapshot.thinkingBudgetTokens ||
      providerConfig.showThinkingSummary !==
        initialProviderSnapshot.showThinkingSummary ||
      !isToolConfigEqual(
        providerConfig.toolConfig,
        initialProviderSnapshot.toolConfig
      )
    );
  }, [initialProviderSnapshot, isToolConfigEqual, providerConfig]);

  const hasMemuChanged = useMemo(() => {
    return (
      memuConfig.enabled !== settings.memu.enabled ||
      memuConfig.apiKey !== settings.memu.apiKey ||
      memuConfig.baseUrl !== settings.memu.baseUrl ||
      memuConfig.autoSave !== settings.memu.autoSave ||
      memuConfig.maxMemories !== settings.memu.maxMemories
    );
  }, [memuConfig, settings.memu]);

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
    onClose,
    providerConfig,
    saveConfigOnClose,
  ]);

  const tokenValue = useMemo(() => parseFloat(tokenInput) || 0, [tokenInput]);
  const charValue = useMemo(() => parseFloat(charInput) || 0, [charInput]);
  const tokenToChar = useMemo(
    () => ({
      english: Math.round(tokenValue / 0.3),
      chinese: Math.round(tokenValue / 0.6),
    }),
    [tokenValue]
  );
  const charToToken = useMemo(
    () => ({
      english: Math.round(charValue * 0.3),
      chinese: Math.round(charValue * 0.6),
    }),
    [charValue]
  );

  if (!isVisible) return null;

  return (
    <div
      className="SettingsModal settings-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4"
      data-state={isClosing ? 'closing' : 'open'}
    >
      <div
        className="settings-panel surface rounded-2xl w-full max-w-[1040px] h-[85vh] max-h-[700px] flex flex-col md:flex-row overflow-hidden relative border-0"
        data-state={isClosing ? 'closing' : 'open'}
      >
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 surface-ghost p-4 md:p-6 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible flex-shrink-0 h-full">
          <h2 className="text-lg md:text-xl font-semibold text-muted mb-0 md:mb-6 hidden md:block">
            {t('settings')}
          </h2>

          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`settings-tab flex items-center gap-2 md:gap-3 px-5 md:px-6 py-3 md:py-3.5 rounded-xl text-[15px] font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'text-text settings-tab-active'
                    : 'text-subtle hover:text-text'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 relative flex flex-col min-w-0">
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full hover:bg-[var(--panel-strong)] text-subtle transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 pr-0 md:p-10 md:pr-0">
            <div className="mx-auto w-full max-w-2xl">
              {activeTab === 'general' && (
                <GeneralTab
                  t={t}
                  settings={settings}
                  themeOptions={themeOptions}
                  supportedLanguages={SUPPORTED_LANGUAGES}
                  dropdownStates={{ language: dropdownStates.language }}
                  languageRef={languageRef}
                  toggleDropdown={toggleDropdown}
                  closeDropdown={closeDropdown}
                  handleThemeChange={handleThemeChange}
                  handleLanguageChange={handleLanguageChange}
                />
              )}

              {activeTab === 'provider' && (
                <ProviderTab
                  t={t}
                  providerRef={providerRef}
                  dropdownStates={{ provider: dropdownStates.provider }}
                  toggleDropdown={toggleDropdown}
                  closeDropdown={closeDropdown}
                  providerOptions={providerOptions}
                  activeProviderLabel={activeProviderLabel}
                  providerConfig={providerConfig}
                  supportsAdvancedParams={supportsAdvancedParams}
                  activeAdvancedSupport={activeAdvancedSupport}
                  temperatureInput={temperatureInput}
                  topPInput={topPInput}
                  topKInput={topKInput}
                  thinkingBudgetInput={thinkingBudgetInput}
                  getDefaultModelForProvider={getDefaultModelForProvider}
                  handleProviderChange={handleProviderChange}
                  handleApiKeyChange={handleApiKeyChange}
                  handleClearApiKey={handleClearApiKey}
                  handleModelChange={handleModelChange}
                  handleApiUrlChange={handleApiUrlChange}
                  handleTemperatureChange={handleTemperatureChange}
                  handleTopPChange={handleTopPChange}
                  handleTopKChange={handleTopKChange}
                  handleThinkingBudgetChange={handleThinkingBudgetChange}
                  handleToggleAdvancedParams={handleToggleAdvancedParams}
                  handleToggleThinkingSummary={handleToggleThinkingSummary}
                  handleToggleStreaming={handleToggleStreaming}
                />
              )}

              {activeTab === 'tools' && (
                <ToolsTab
                  t={t}
                  toolOptions={toolOptions}
                  providerConfig={providerConfig}
                  toolChoiceOptions={toolChoiceOptions}
                  activeToolChoiceLabel={activeToolChoiceLabel}
                  dropdownStates={{ toolChoice: dropdownStates.toolChoice }}
                  toolChoiceRef={toolChoiceRef}
                  toggleDropdown={toggleDropdown}
                  closeDropdown={closeDropdown}
                  normalizeToolConfig={normalizeToolConfig}
                  handleToggleTool={handleToggleTool}
                  handleToolChoiceChange={handleToolChoiceChange}
                  handleToolChoiceNameChange={handleToolChoiceNameChange}
                />
              )}

              {activeTab === 'memory' && (
                <MemoryTab
                  t={t}
                  memuConfig={memuConfig}
                  handleMemuConfigChange={handleMemuConfigChange}
                />
              )}

              {activeTab === 'data' && (
                <DataTab
                  t={t}
                  calculationMode={calculationMode}
                  setCalculationMode={setCalculationMode}
                  tokenInput={tokenInput}
                  setTokenInput={setTokenInput}
                  charInput={charInput}
                  setCharInput={setCharInput}
                  tokenToChar={tokenToChar}
                  charToToken={charToToken}
                  sanitizeNumber={sanitizeNumber}
                />
              )}

              {activeTab === 'about' && <AboutTab t={t} />}

              {activeTab !== 'general' &&
                activeTab !== 'provider' &&
                activeTab !== 'tools' &&
                activeTab !== 'memory' &&
                activeTab !== 'data' &&
                activeTab !== 'about' && (
                  <div className="flex flex-col items-center justify-center h-full text-subtle min-h-[200px]">
                    <Info className="w-10 h-10 mb-3 opacity-20" />
                    <p>{t('development')}</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
