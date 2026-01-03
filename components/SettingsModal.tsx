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
  Settings as SettingsIcon,
  User,
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
import { Theme, ExtendedUserSettings, ToolChoiceMode } from '../types';
// Contexts
import { useTranslation } from '../contexts/useTranslation';
// Services
import { getDefaultModelForProvider } from '../services/config/providerConfig';
import { listTools, ToolDefinition } from '../services/tools/toolRegistry';
// Utils
import { normalizeToolConfig } from '../utils/configUtils';
// Hooks
import { useSettingsModal } from '../hooks/useSettingsModal';
// Components
import SettingsContent from './settings/SettingsContent';

interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly settings: ExtendedUserSettings;
  readonly onUpdateSettings: (newSettings: ExtendedUserSettings) => void;
}

import SettingsTabs, {
  SettingsTabId,
  TabConfig,
} from './settings/SettingsTabs';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const { t } = useTranslation();
  const modalTransitionMs = 180;

  // Use custom hook for settings management
  const {
    providerConfig,
    memuConfig,
    temperatureInput,
    topPInput,
    topKInput,
    thinkingBudgetInput,
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
    handleToggleTool,
    handleToolChoiceChange,
    handleToolChoiceNameChange,
    handleMemuConfigChange,
    handleClose,
  } = useSettingsModal({
    settings,
    onUpdateSettings,
    onClose,
    modalTransitionMs,
  });

  // UI state
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

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

  const tabs = useMemo<ReadonlyArray<TabConfig>>(
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

  // Token calculator state
  const [tokenInput, setTokenInput] = useState('');
  const [charInput, setCharInput] = useState('');
  const [calculationMode, setCalculationMode] = useState<
    'tokenToChar' | 'charToToken'
  >('tokenToChar');

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

  const providerOptions = useMemo(
    () =>
      [
        { id: 'openai' as const, label: t('openai') },
        { id: 'xai' as const, label: t('xai') },
        { id: 'z' as const, label: t('z') },
        { id: 'z-intl' as const, label: t('zIntl') },
        { id: 'deepseek' as const, label: t('deepseek') },
        { id: 'openai-compatible' as const, label: t('openaiCompatible') },
        { id: 'bailing' as const, label: t('bailing') },
        { id: 'longcat' as const, label: t('longcat') },
        { id: 'moonshot' as const, label: t('moonshot') },
        { id: 'minimax' as const, label: t('minimax') },
        { id: 'gemini' as const, label: t('gemini') },
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
      xai: { topP: true, topK: true },
      'openai-compatible': { topP: true, topK: true },
      z: { topP: true, topK: true },
      'z-intl': { topP: true, topK: true },
      deepseek: { topP: true, topK: true },
      bailing: { topP: true, topK: true },
      longcat: { topP: true, topK: true },
      moonshot: { topP: true, topK: true },
      minimax: { topP: true, topK: true },
      gemini: { topP: true, topK: true },
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
  }, [providerConfig.toolConfig, toolChoiceOptions]);

  // Wrapped provider change handler with dropdown close
  const handleProviderChangeWithClose = useCallback(
    (provider: ProviderType) => {
      handleProviderChange(provider);
      closeDropdown('provider');
    },
    [handleProviderChange, closeDropdown]
  );

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
        <SettingsTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          title={t('settings')}
        />

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
          <SettingsContent
            t={t}
            activeTab={activeTab}
            settings={settings}
            themeOptions={themeOptions}
            dropdownStates={dropdownStates}
            languageRef={languageRef}
            providerRef={providerRef}
            toolChoiceRef={toolChoiceRef}
            toggleDropdown={toggleDropdown}
            closeDropdown={closeDropdown}
            handleThemeChange={handleThemeChange}
            handleLanguageChange={handleLanguageChange}
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
            handleProviderChange={handleProviderChangeWithClose}
            handleApiKeyChange={handleApiKeyChange}
            handleClearApiKey={handleClearApiKey}
            handleModelChange={handleModelChange}
            handleApiUrlChange={handleApiUrlChange}
            handleTemperatureChange={handleTemperatureChange}
            handleTopPChange={handleTopPChange}
            handleTopKChange={handleTopKChange}
            handleThinkingBudgetChange={handleThinkingBudgetChange}
            handleToggleAdvancedParams={handleToggleAdvancedParams}
            handleToggleStreaming={handleToggleStreaming}
            toolOptions={toolOptions}
            toolChoiceOptions={toolChoiceOptions}
            activeToolChoiceLabel={activeToolChoiceLabel}
            handleToggleTool={handleToggleTool}
            handleToolChoiceChange={handleToolChoiceChange}
            handleToolChoiceNameChange={handleToolChoiceNameChange}
            memuConfig={memuConfig}
            handleMemuConfigChange={handleMemuConfigChange}
            calculationMode={calculationMode}
            setCalculationMode={setCalculationMode}
            tokenInput={tokenInput}
            setTokenInput={setTokenInput}
            charInput={charInput}
            setCharInput={setCharInput}
            tokenToChar={tokenToChar}
            charToToken={charToToken}
          />
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
