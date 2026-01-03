import React from 'react';
import { Info } from 'lucide-react';
import type { ProviderType, Theme, ToolChoiceMode } from '../../types';
import type { ToolDefinition } from '../../services/tools/toolRegistry';
import { SUPPORTED_LANGUAGES } from '../../constants';
import { normalizeToolConfig, sanitizeNumber } from '../../utils/configUtils';
import type { SettingsTabId } from './SettingsTabs';
import AboutTab from './tabs/AboutTab';
import DataTab from './tabs/DataTab';
import GeneralTab from './tabs/GeneralTab';
import MemoryTab from './tabs/MemoryTab';
import ProviderTab from './tabs/ProviderTab';
import ToolsTab from './tabs/ToolsTab';

type ThemeOption = {
  value: Theme;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

type MemuConfig = {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  autoSave: boolean;
  maxMemories: number;
};

interface SettingsContentProps {
  readonly t: (key: string) => string;
  readonly activeTab: SettingsTabId;
  readonly settings: { language: string; theme: Theme };
  readonly themeOptions: ThemeOption[];
  readonly dropdownStates: {
    language: boolean;
    provider: boolean;
    toolChoice: boolean;
  };
  readonly languageRef: React.RefObject<HTMLDivElement>;
  readonly providerRef: React.RefObject<HTMLDivElement>;
  readonly toolChoiceRef: React.RefObject<HTMLDivElement>;
  readonly toggleDropdown: (
    key: 'language' | 'provider' | 'toolChoice'
  ) => void;
  readonly closeDropdown: (key: 'language' | 'provider' | 'toolChoice') => void;
  readonly handleThemeChange: (theme: Theme) => void;
  readonly handleLanguageChange: (language: string) => void;
  readonly providerOptions: Array<{ id: ProviderType; label: string }>;
  readonly activeProviderLabel: string;
  readonly providerConfig: {
    provider: ProviderType;
    toolConfig?: {
      enabledToolNames?: string[];
      toolChoice?: ToolChoiceMode;
      toolChoiceName?: string;
    };
  };
  readonly supportsAdvancedParams: boolean;
  readonly activeAdvancedSupport: { topP: boolean; topK: boolean } | null;
  readonly temperatureInput: string;
  readonly topPInput: string;
  readonly topKInput: string;
  readonly thinkingBudgetInput: string;
  readonly getDefaultModelForProvider: (provider: ProviderType) => string;
  readonly handleProviderChange: (provider: ProviderType) => void;
  readonly handleApiKeyChange: (value: string) => void;
  readonly handleClearApiKey: () => void;
  readonly handleModelChange: (value: string) => void;
  readonly handleApiUrlChange: (value: string) => void;
  readonly handleTemperatureChange: (value: string) => void;
  readonly handleTopPChange: (value: string) => void;
  readonly handleTopKChange: (value: string) => void;
  readonly handleThinkingBudgetChange: (value: string) => void;
  readonly handleToggleAdvancedParams: () => void;
  readonly handleToggleStreaming: () => void;
  readonly toolOptions: ToolDefinition[];
  readonly toolChoiceOptions: Array<{ id: ToolChoiceMode; label: string }>;
  readonly activeToolChoiceLabel: string;
  readonly handleToggleTool: (name: string) => void;
  readonly handleToolChoiceChange: (choice: ToolChoiceMode) => void;
  readonly handleToolChoiceNameChange: (name: string) => void;
  readonly memuConfig: MemuConfig;
  readonly handleMemuConfigChange: (updates: Partial<MemuConfig>) => void;
  readonly calculationMode: 'tokenToChar' | 'charToToken';
  readonly setCalculationMode: (mode: 'tokenToChar' | 'charToToken') => void;
  readonly tokenInput: string;
  readonly setTokenInput: (value: string) => void;
  readonly charInput: string;
  readonly setCharInput: (value: string) => void;
  readonly tokenToChar: { english: number; chinese: number };
  readonly charToToken: { english: number; chinese: number };
}

const SettingsContent: React.FC<SettingsContentProps> = ({
  t,
  activeTab,
  settings,
  themeOptions,
  dropdownStates,
  languageRef,
  providerRef,
  toolChoiceRef,
  toggleDropdown,
  closeDropdown,
  handleThemeChange,
  handleLanguageChange,
  providerOptions,
  activeProviderLabel,
  providerConfig,
  supportsAdvancedParams,
  activeAdvancedSupport,
  temperatureInput,
  topPInput,
  topKInput,
  thinkingBudgetInput,
  getDefaultModelForProvider,
  handleProviderChange,
  handleApiKeyChange,
  handleClearApiKey,
  handleModelChange,
  handleApiUrlChange,
  handleTemperatureChange,
  handleTopPChange,
  handleTopKChange,
  handleThinkingBudgetChange,
  handleToggleAdvancedParams,
  handleToggleStreaming,
  toolOptions,
  toolChoiceOptions,
  activeToolChoiceLabel,
  handleToggleTool,
  handleToolChoiceChange,
  handleToolChoiceNameChange,
  memuConfig,
  handleMemuConfigChange,
  calculationMode,
  setCalculationMode,
  tokenInput,
  setTokenInput,
  charInput,
  setCharInput,
  tokenToChar,
  charToToken,
}) => (
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
);

export default SettingsContent;
