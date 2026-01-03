// Hooks
import React from 'react';
// Icons
import { Check, Trash2 } from 'lucide-react';
// Types
import type { ProviderConfig } from '../../../services/config/providerConfig';
import type { ProviderType } from '../../../types';

type ProviderOption = { id: ProviderType; label: string };
type AdvancedSupport = { topP: boolean; topK: boolean };

type ProviderTabProps = {
  t: (key: string) => string;
  providerRef: React.RefObject<HTMLDivElement>;
  dropdownStates: { provider: boolean };
  toggleDropdown: (key: 'provider') => void;
  closeDropdown: (key: 'provider') => void;
  providerOptions: ProviderOption[];
  activeProviderLabel: string;
  providerConfig: ProviderConfig;
  supportsAdvancedParams: boolean;
  activeAdvancedSupport: AdvancedSupport | null;
  temperatureInput: string;
  topPInput: string;
  topKInput: string;
  thinkingBudgetInput: string;
  getDefaultModelForProvider: (provider: ProviderType) => string;
  handleProviderChange: (provider: ProviderType) => void;
  handleApiKeyChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleClearApiKey: () => void;
  handleModelChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleApiUrlChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleTemperatureChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleTopPChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleTopKChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleThinkingBudgetChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  handleToggleAdvancedParams: () => void;
  handleToggleStreaming: () => void;
};

const ProviderTab: React.FC<ProviderTabProps> = ({
  t,
  providerRef,
  dropdownStates,
  toggleDropdown,
  closeDropdown,
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
}) => {
  return (
    <div className="space-y-6 max-w-xl">
      <div className="space-y-2 relative z-20" ref={providerRef}>
        <label className="block text-sm text-subtle">{t('provider')}</label>
        <button
          onClick={() => toggleDropdown('provider')}
          className="lang-trigger w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <span>{activeProviderLabel}</span>
        </button>

        {dropdownStates.provider && (
          <div className="absolute top-full right-0 mt-2 w-full surface rounded-xl shadow-soft border-faint max-h-60 overflow-y-auto overflow-x-hidden py-1.5 scrollbar-thin z-50">
            {providerOptions.map(option => (
              <button
                key={option.id}
                className="lang-option w-full flex items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[var(--panel-strong)] transition-colors text-text"
                onClick={() => {
                  handleProviderChange(option.id);
                  closeDropdown('provider');
                }}
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
        <label className="block text-sm text-subtle">{t('apiKey')}</label>
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
        <label className="block text-sm text-subtle">{t('modelName')}</label>
        <input
          type="text"
          className="provider-field w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none"
          placeholder={getDefaultModelForProvider(providerConfig.provider)}
          value={providerConfig.model}
          onChange={handleModelChange}
        />
      </div>

      {providerConfig.provider === 'openai-compatible' && (
        <div className="space-y-2">
          <label className="block text-sm text-subtle">{t('apiUrl')}</label>
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
        <label className="block text-sm text-subtle">{t('temperature')}</label>
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

      {supportsAdvancedParams && providerConfig.showAdvancedParams && (
        <div className="space-y-2">
          {activeAdvancedSupport?.topP && (
            <div className="space-y-2">
              <label className="block text-sm text-subtle">{t('topP')}</label>
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
              <label className="block text-sm text-subtle">{t('topK')}</label>
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

      <div className="streaming-toggle-container flex flex-col gap-3 p-4 rounded-xl border border-[var(--border)]">
        <label className="block text-sm text-text font-medium">
          {t('thinkingBudget')}
        </label>
        <input
          type="text"
          className="provider-field w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none"
          placeholder={t('thinkingBudgetPlaceholder')}
          value={thinkingBudgetInput}
          onChange={handleThinkingBudgetChange}
        />
        <p className="text-xs text-subtle">{t('thinkingBudgetHint')}</p>
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
            providerConfig.stream ? 'bg-[var(--accent)]' : 'bg-[var(--pill)]'
          }`}
          aria-pressed={providerConfig.stream}
          aria-label={t('streaming')}
        >
          <span
            className={`streaming-toggle-thumb inline-block h-5 w-5 transform rounded-full toggle-thumb shadow transition-transform duration-200 ${
              providerConfig.stream ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <p className="text-sm text-subtle text-center">{t('streamingHint')}</p>

      {(providerConfig.provider === 'deepseek' ||
        providerConfig.provider === 'longcat' ||
        providerConfig.provider === 'bailing' ||
        providerConfig.provider === 'moonshot' ||
        providerConfig.provider === 'gemini') && (
        <div className="text-sm text-subtle text-center">
          {t('autoModelSwitch')}
        </div>
      )}
    </div>
  );
};

export default ProviderTab;
