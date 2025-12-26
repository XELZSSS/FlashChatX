import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  X,
  User,
  Settings as SettingsIcon,
  Info,
  Monitor,
  Moon,
  Sun,
  Check,
  ChevronDown,
  Cloud,
  Trash2,
  Brain,
  Calculator,
  Wrench,
} from 'lucide-react';
import type { ProviderType } from '../types';
import {
  Theme,
  ExtendedUserSettings,
  MemuSettings,
  ToolChoiceMode,
} from '../types';
import { SUPPORTED_LANGUAGES, MEMU_DEFAULTS } from '../constants';
import { useTranslation } from '../contexts/useTranslation';
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
import PlatformLinks from './PlatformLinks';

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
      void (async () => {
        if (hasProviderChanged) {
          await saveConfigOnClose(providerSnapshot);
        }
        if (hasMemuChanged) {
          await handleSaveMemuConfig();
        }
      })();
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

  if (!isOpen) return null;

  return (
    <div className="SettingsModal fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="surface rounded-2xl w-full max-w-[1040px] h-[85vh] max-h-[700px] flex flex-col md:flex-row overflow-hidden relative border-0">
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
                <div className="space-y-8 md:space-y-10 max-w-xl">
                  {/* Theme Section */}
                  <div className="space-y-4">
                    <label className="block text-base text-subtle">
                      {t('theme')}
                    </label>
                    <div className="grid grid-cols-3 gap-3 md:gap-4">
                      {themeOptions.map(themeOption => {
                        const Icon = themeOption.icon;
                        const isActive = settings.theme === themeOption.value;
                        return (
                          <button
                            key={themeOption.value}
                            onClick={() => handleThemeChange(themeOption.value)}
                            className={`theme-card flex flex-col items-center justify-center py-3 md:py-5 px-2 rounded-2xl border transition-all duration-200 gap-2 md:gap-3 ${
                              isActive
                                ? 'border-[var(--border)] bg-[var(--panel-strong)] text-text ring-1 ring-slate-400/20 theme-card-active'
                                : 'border surface text-subtle hover:border hover:bg-[var(--panel-strong)]'
                            }`}
                          >
                            <Icon className="w-5 h-5 md:w-6 md:h-6" />
                            <span className="text-sm md:text-base font-medium">
                              {themeOption.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Language Section */}
                  <div className="space-y-4 relative z-20">
                    <label className="block text-base text-subtle">
                      {t('language')}
                    </label>
                    <div className="relative w-full sm:w-64">
                      <button
                        onClick={() => toggleDropdown('language')}
                        className="lang-trigger w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-base font-medium transition-colors"
                      >
                        <span>{settings.language}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-subtle transition-transform duration-200 ${dropdownStates.language ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {dropdownStates.language && (
                        <div className="absolute top-full right-0 mt-2 w-64 surface rounded-xl shadow-soft border-faint max-h-60 md:max-h-80 overflow-y-auto overflow-x-hidden py-1.5 scrollbar-thin z-50">
                          {SUPPORTED_LANGUAGES.map(lang => {
                            const isSelected = settings.language === lang;
                            return (
                              <button
                                key={lang}
                                onClick={() => {
                                  handleLanguageChange(lang);
                                  closeDropdown('language');
                                }}
                                className="lang-option w-full flex items-center justify-between px-4 py-2.5 text-left text-base hover:bg-[var(--panel-strong)] transition-colors text-text"
                              >
                                <span>{lang}</span>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-muted" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'provider' && (
                <div className="space-y-6 max-w-xl">
                  <div className="space-y-2 relative z-20" ref={providerRef}>
                    <label className="block text-sm text-subtle">
                      {t('provider')}
                    </label>
                    <button
                      onClick={() => toggleDropdown('provider')}
                      className="lang-trigger w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      <span>{activeProviderLabel}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-subtle transition-transform duration-200 ${dropdownStates.provider ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {dropdownStates.provider && (
                      <div className="absolute top-full right-0 mt-2 w-full surface rounded-xl shadow-soft border-faint max-h-60 overflow-y-auto overflow-x-hidden py-1.5 scrollbar-thin z-50">
                        {providerOptions.map(option => (
                          <button
                            key={option.id}
                            className="lang-option w-full flex items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[var(--panel-strong)] transition-colors text-text"
                            onClick={() => handleProviderChange(option.id)}
                          >
                            <span>{option.label}</span>
                            {providerConfig.provider === option.id && (
                              <Check className="w-4 h-4 text-muted" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm text-subtle">
                      {t('apiKey')}
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        className="provider-field w-full rounded-xl border px-4 py-2.5 pr-12 text-sm focus:outline-none"
                        placeholder="API Key"
                        value={providerConfig.apiKey}
                        onChange={handleApiKeyChange}
                      />
                      <button
                        type="button"
                        onClick={handleClearApiKey}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md hover:bg-[var(--panel-strong)] text-subtle hover:text-muted transition-colors"
                        title={t('clearApiKey')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm text-subtle">
                      {t('modelName')}
                    </label>
                    <input
                      type="text"
                      className="provider-field w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none"
                      placeholder={getDefaultModelForProvider(
                        providerConfig.provider
                      )}
                      value={providerConfig.model}
                      onChange={handleModelChange}
                    />
                  </div>

                  {/* API URL field for OpenAI Compatible provider */}
                  {providerConfig.provider === 'openai-compatible' && (
                    <div className="space-y-2">
                      <label className="block text-sm text-subtle">
                        {t('apiUrl')}
                      </label>
                      <input
                        type="text"
                        className="provider-field w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none"
                        placeholder={t('apiUrlPlaceholder')}
                        value={providerConfig.apiUrl || ''}
                        onChange={handleApiUrlChange}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-sm text-subtle">
                      {t('temperature')}
                    </label>
                    <input
                      type="text"
                      className="provider-field w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none"
                      placeholder="0.0"
                      value={temperatureInput}
                      onChange={handleTemperatureChange}
                    />
                  </div>

                  {supportsAdvancedParams && (
                    <div className="streaming-toggle-container flex items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border)]">
                      <div className="flex-1">
                        <label className="block text-sm text-text font-medium">
                          {t('advancedParams')}
                        </label>
                        <p className="text-xs text-subtle mt-1">
                          {t('advancedParamsHint')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleAdvancedParams}
                        className={`streaming-toggle relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                          providerConfig.showAdvancedParams
                            ? 'bg-[var(--accent)]'
                            : 'bg-[var(--pill)]'
                        }`}
                        aria-pressed={!!providerConfig.showAdvancedParams}
                        aria-label={t('advancedParams')}
                      >
                        <span
                          className={`streaming-toggle-thumb inline-block h-5 w-5 transform rounded-full toggle-thumb shadow transition-transform duration-200 ${
                            providerConfig.showAdvancedParams
                              ? 'translate-x-5'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {supportsAdvancedParams &&
                    providerConfig.showAdvancedParams && (
                      <div className="space-y-2">
                        {activeAdvancedSupport?.topP && (
                          <div className="space-y-2">
                            <label className="block text-sm text-subtle">
                              {t('topP')}
                            </label>
                            <input
                              type="text"
                              className="provider-field w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none"
                              placeholder="0.0"
                              value={topPInput}
                              onChange={handleTopPChange}
                            />
                          </div>
                        )}
                        {activeAdvancedSupport?.topK && (
                          <div className="space-y-2">
                            <label className="block text-sm text-subtle">
                              {t('topK')}
                            </label>
                            <input
                              type="text"
                              className="provider-field w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none"
                              placeholder="0"
                              value={topKInput}
                              onChange={handleTopKChange}
                            />
                          </div>
                        )}
                      </div>
                    )}

                  <div className="streaming-toggle-container flex items-start justify-between gap-3 p-4 rounded-xl border border-[var(--border)]">
                    <div className="flex-1">
                      <label className="block text-sm text-text font-medium">
                        {t('showThinkingSummary')}
                      </label>
                      <div className="mt-3 space-y-2">
                        <label className="block text-sm text-subtle">
                          {t('thinkingBudget')}
                        </label>
                        <input
                          type="text"
                          className="provider-field w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none"
                          placeholder={t('thinkingBudgetPlaceholder')}
                          value={thinkingBudgetInput}
                          onChange={handleThinkingBudgetChange}
                        />
                        <p className="text-xs text-subtle">
                          {t('thinkingBudgetHint')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleThinkingSummary}
                      className={`streaming-toggle relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                        providerConfig.showThinkingSummary
                          ? 'bg-[var(--accent)]'
                          : 'bg-[var(--pill)]'
                      }`}
                      aria-pressed={!!providerConfig.showThinkingSummary}
                      aria-label={t('showThinkingSummary')}
                    >
                      <span
                        className={`streaming-toggle-thumb inline-block h-5 w-5 transform rounded-full toggle-thumb shadow transition-transform duration-200 ${
                          providerConfig.showThinkingSummary
                            ? 'translate-x-5'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="streaming-toggle-container flex items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border)]">
                    <div className="flex-1">
                      <label className="block text-sm text-text font-medium">
                        {t('streaming')}
                      </label>
                      <p className="text-xs text-subtle mt-1">
                        {t('streamingDescription')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleStreaming}
                      className={`streaming-toggle relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                        providerConfig.stream
                          ? 'bg-[var(--accent)]'
                          : 'bg-[var(--pill)]'
                      }`}
                      aria-pressed={providerConfig.stream}
                      aria-label={t('streaming')}
                    >
                      <span
                        className={`streaming-toggle-thumb inline-block h-5 w-5 transform rounded-full toggle-thumb shadow transition-transform duration-200 ${
                          providerConfig.stream
                            ? 'translate-x-5'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-sm text-subtle text-center">
                    {t('streamingHint')}
                  </p>

                  {/* Auto model switch hint for specific providers */}
                  {(providerConfig.provider === 'deepseek' ||
                    providerConfig.provider === 'longcat' ||
                    providerConfig.provider === 'bailing' ||
                    providerConfig.provider === 'moonshot') && (
                    <div className="text-sm text-subtle text-center">
                      {t('autoModelSwitch')}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tools' && (
                <div className="space-y-6 max-w-xl">
                  <div className="space-y-2">
                    <label className="block text-base text-text font-medium">
                      {t('toolPermissions')}
                    </label>
                    <p className="text-sm text-subtle">
                      {t('toolPermissionsSubtitle')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {toolOptions.map(tool => {
                      const activeToolConfig = normalizeToolConfig(
                        providerConfig.toolConfig
                      );
                      const checked =
                        activeToolConfig.enabledToolNames.includes(tool.name);
                      return (
                        <div
                          key={tool.name}
                          className="streaming-toggle-container flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-4 py-4 text-base"
                        >
                          <div className="space-y-1">
                            <div className="font-medium text-[var(--text)]">
                              {tool.titleKey ? t(tool.titleKey) : tool.title}
                            </div>
                            <div className="text-sm text-subtle">
                              {tool.descriptionKey
                                ? t(tool.descriptionKey)
                                : tool.description}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleTool(tool.name)}
                            className={`streaming-toggle relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                              checked
                                ? 'bg-[var(--accent)]'
                                : 'bg-[var(--pill)]'
                            }`}
                          >
                            <span
                              className={`streaming-toggle-thumb inline-block h-5 w-5 transform rounded-full toggle-thumb shadow transition-transform duration-200 ${
                                checked ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-base text-subtle">
                      {t('toolChoice')}
                    </label>
                    <p className="text-sm text-subtle">{t('toolChoiceHint')}</p>
                    <div className="relative" ref={toolChoiceRef}>
                      <button
                        onClick={() => toggleDropdown('toolChoice')}
                        className="lang-trigger w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-base font-medium transition-colors"
                      >
                        <span>{activeToolChoiceLabel}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-subtle transition-transform duration-200 ${dropdownStates.toolChoice ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {dropdownStates.toolChoice && (
                        <div className="absolute top-full right-0 mt-2 w-full surface rounded-xl shadow-soft border-faint max-h-60 overflow-y-auto overflow-x-hidden py-1.5 scrollbar-thin z-50">
                          {toolChoiceOptions.map(option => (
                            <button
                              key={option.id}
                              className="lang-option w-full flex items-center justify-between px-4 py-2.5 text-left text-base hover:bg-[var(--panel-strong)] transition-colors text-text"
                              onClick={() => {
                                handleToolChoiceChange(option.id);
                                closeDropdown('toolChoice');
                              }}
                            >
                              <span>{option.label}</span>
                              {normalizeToolConfig(providerConfig.toolConfig)
                                .toolChoice === option.id && (
                                <Check className="w-4 h-4 text-muted" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {normalizeToolConfig(providerConfig.toolConfig).toolChoice ===
                    'specific' && (
                    <div className="space-y-2">
                      <label className="block text-base text-subtle">
                        {t('toolChoiceSpecificLabel')}
                      </label>
                      <input
                        type="text"
                        className="provider-field w-full rounded-xl border px-4 py-2.5 text-base focus:outline-none"
                        placeholder={t('toolChoiceSpecificPlaceholder')}
                        value={
                          normalizeToolConfig(providerConfig.toolConfig)
                            .toolChoiceName
                        }
                        onChange={event =>
                          handleToolChoiceNameChange(event.target.value)
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'memory' && (
                <div className="space-y-6 max-w-xl mt-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-faint surface">
                      <div className="flex-1">
                        <label className="block text-base text-muted font-medium">
                          {t('enableMemory')}
                        </label>
                        <p className="text-sm text-subtle mt-1">
                          {t('memoryDescription')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleMemuConfigChange('enabled', !memuConfig.enabled)
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                          memuConfig.enabled
                            ? 'bg-[var(--accent)]'
                            : 'bg-[var(--pill)]'
                        }`}
                        aria-pressed={memuConfig.enabled}
                        aria-label={t('enableMemory')}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full toggle-thumb shadow transition-transform duration-200 ${
                            memuConfig.enabled
                              ? 'translate-x-5'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {!memuConfig.enabled && (
                      <p className="text-base text-subtle text-center">
                        {t('memoryExperimentalHint')}
                      </p>
                    )}
                  </div>

                  {memuConfig.enabled && (
                    <>
                      <div className="space-y-2">
                        <label className="block text-base text-subtle">
                          {t('memoryApiKey')}
                        </label>
                        <div className="relative">
                          <input
                            type="password"
                            className="provider-field w-full rounded-xl border px-4 py-2.5 pr-12 text-base focus:outline-none"
                            placeholder={t('memoryApiKeyPlaceholder')}
                            value={memuConfig.apiKey}
                            onChange={e =>
                              handleMemuConfigChange('apiKey', e.target.value)
                            }
                          />
                          <button
                            type="button"
                            onClick={() => handleMemuConfigChange('apiKey', '')}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md hover:bg-[var(--panel-strong)] text-subtle hover:text-muted transition-colors"
                            title={t('clearApiKey')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-base text-subtle">
                          {t('memoryBaseUrl')}
                        </label>
                        <input
                          type="text"
                          className="provider-field w-full rounded-xl border px-4 py-2.5 text-base focus:outline-none"
                          placeholder={t('memoryBaseUrlPlaceholder')}
                          value={memuConfig.baseUrl}
                          onChange={e =>
                            handleMemuConfigChange('baseUrl', e.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-base text-subtle">
                          {t('maxMemories')}
                        </label>
                        <input
                          type="text"
                          min="1"
                          max="50"
                          className="provider-field w-full rounded-xl border px-4 py-2.5 text-base focus:outline-none"
                          value={memuConfig.maxMemories}
                          onChange={e => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            handleMemuConfigChange(
                              'maxMemories',
                              parseInt(value, 10) || MEMU_DEFAULTS.MAX_MEMORIES
                            );
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-faint surface">
                        <div className="flex-1">
                          <label className="block text-base text-muted font-medium">
                            {t('autoSaveMemory')}
                          </label>
                          <p className="text-sm text-subtle mt-1">
                            Automatically save conversations to memory
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleMemuConfigChange(
                              'autoSave',
                              !memuConfig.autoSave
                            )
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                            memuConfig.autoSave
                              ? 'bg-[var(--accent)]'
                              : 'bg-[var(--pill)]'
                          }`}
                          aria-pressed={memuConfig.autoSave}
                          aria-label={t('autoSaveMemory')}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full toggle-thumb shadow transition-transform duration-200 ${
                              memuConfig.autoSave
                                ? 'translate-x-5'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="mt-3">
                        <a
                          href="https://app.memu.so/login"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-soft)] text-accent rounded-lg hover:bg-[var(--accent)] hover:text-white transition-colors text-base font-medium"
                        >
                          {t('memuPlatformLink')}
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'data' && (
                <div className="space-y-8 max-w-xl">
                  {/* Token Calculator Section */}
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pr-12">
                      <div className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-muted" />
                        <h3 className="text-xl font-semibold text-muted">
                          {t('tokenCalculator')}
                        </h3>
                      </div>
                      <div className="flex items-center rounded-full bg-[var(--panel-strong)] p-1">
                        <button
                          onClick={() => setCalculationMode('tokenToChar')}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            calculationMode === 'tokenToChar'
                              ? 'bg-[var(--accent)] text-white'
                              : 'text-subtle hover:text-[var(--text)]'
                          }`}
                        >
                          {t('tokenToChar')}
                        </button>
                        <button
                          onClick={() => setCalculationMode('charToToken')}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            calculationMode === 'charToToken'
                              ? 'bg-[var(--accent)] text-white'
                              : 'text-subtle hover:text-[var(--text)]'
                          }`}
                        >
                          {t('charToToken')}
                        </button>
                      </div>
                    </div>

                    {/* Input Section */}
                    <div className="space-y-4">
                      {calculationMode === 'tokenToChar' ? (
                        <div className="space-y-2">
                          <label className="block text-base text-subtle">
                            {t('tokenCount')}
                          </label>
                          <input
                            type="text"
                            className="provider-field w-full rounded-xl border px-4 py-2.5 text-base focus:outline-none"
                            placeholder={t('enterTokenCount')}
                            value={tokenInput}
                            onChange={e =>
                              setTokenInput(sanitizeNumber(e.target.value))
                            }
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-base text-subtle">
                            {t('characterCount')}
                          </label>
                          <input
                            type="text"
                            className="provider-field w-full rounded-xl border px-4 py-2.5 text-base focus:outline-none"
                            placeholder={t('enterCharacterCount')}
                            value={charInput}
                            onChange={e =>
                              setCharInput(sanitizeNumber(e.target.value))
                            }
                          />
                        </div>
                      )}

                      {(tokenInput || charInput) && (
                        <div className="text-base text-muted">
                          <div className="font-medium mb-2">
                            {t('conversionResult')}
                          </div>
                          {calculationMode === 'tokenToChar' ? (
                            <div className="space-y-1">
                              <div>
                                {t('englishCharacters')}: {tokenToChar.english}
                              </div>
                              <div>
                                {t('chineseCharacters')}: {tokenToChar.chinese}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div>
                                {t('englishTokens')}: {charToToken.english}
                              </div>
                              <div>
                                {t('chineseTokens')}: {charToToken.chinese}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Conversion Reference */}
                    <div className="p-4 surface-ghost rounded-lg">
                      <div className="text-base text-subtle">
                        <div className="font-medium mb-2">
                          {t('conversionReference')}
                        </div>
                        <div className="space-y-1 text-sm">
                          <div>{t('tokenConversionRef1')}</div>
                          <div>{t('tokenConversionRef2')}</div>
                          <div>{t('tokenConversionRef3')}</div>
                          <div>{t('tokenConversionRef4')}</div>
                          <div>{t('tokenConversionRef5')}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-base text-subtle">
                      {t('tokenCalculatorNote')}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'about' && (
                <div className="space-y-6 max-w-xl">
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-muted">
                      {t('about')}
                    </h3>
                    <PlatformLinks />
                  </div>
                </div>
              )}

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
