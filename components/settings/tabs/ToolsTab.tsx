// Hooks
import React from 'react';
// Icons
import { Check } from 'lucide-react';
// Types
import type { ProviderConfig } from '../../../services/config/providerConfig';
import type { ToolChoiceMode } from '../../../types';
import type { ToolDefinition } from '../../../services/tools/toolRegistry';

type ToolChoiceOption = { id: ToolChoiceMode; label: string };

type ToolsTabProps = {
  t: (key: string) => string;
  toolOptions: ToolDefinition[];
  providerConfig: ProviderConfig;
  toolChoiceOptions: ToolChoiceOption[];
  activeToolChoiceLabel: string;
  dropdownStates: { toolChoice: boolean };
  toolChoiceRef: React.RefObject<HTMLDivElement>;
  toggleDropdown: (key: 'toolChoice') => void;
  closeDropdown: (key: 'toolChoice') => void;
  normalizeToolConfig: (config?: ProviderConfig['toolConfig']) => {
    enabledToolNames: string[];
    toolChoice: ToolChoiceMode;
    toolChoiceName: string;
  };
  handleToggleTool: (toolName: string) => void;
  handleToolChoiceChange: (value: ToolChoiceMode) => void;
  handleToolChoiceNameChange: (value: string) => void;
};

const ToolsTab: React.FC<ToolsTabProps> = ({
  t,
  toolOptions,
  providerConfig,
  toolChoiceOptions,
  activeToolChoiceLabel,
  dropdownStates,
  toolChoiceRef,
  toggleDropdown,
  closeDropdown,
  normalizeToolConfig,
  handleToggleTool,
  handleToolChoiceChange,
  handleToolChoiceNameChange,
}) => {
  const activeToolConfig = normalizeToolConfig(providerConfig.toolConfig);

  return (
    <div className="space-y-6 max-w-xl">
      <div className="space-y-2">
        <label className="block text-base text-text font-medium">
          {t('toolPermissions')}
        </label>
        <p className="text-sm text-subtle">{t('toolPermissionsSubtitle')}</p>
      </div>
      <div className="space-y-2">
        {toolOptions.map(tool => {
          const checked = activeToolConfig.enabledToolNames.includes(tool.name);
          return (
            <div
              key={tool.name}
              className="flex items-center justify-between gap-4 rounded-xl border border-faint px-4 py-3"
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
                  checked ? 'bg-[var(--accent)]' : 'bg-[var(--pill)]'
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
        <label className="block text-base text-subtle">{t('toolChoice')}</label>
        <p className="text-sm text-subtle">{t('toolChoiceHint')}</p>
        <div className="relative" ref={toolChoiceRef}>
          <button
            onClick={() => toggleDropdown('toolChoice')}
            className="lang-trigger w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-base font-medium transition-colors"
          >
            <span>{activeToolChoiceLabel}</span>
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
                  {normalizeToolConfig(providerConfig.toolConfig).toolChoice ===
                    option.id && <Check className="w-4 h-4 text-muted" />}
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
              normalizeToolConfig(providerConfig.toolConfig).toolChoiceName
            }
            onChange={event => handleToolChoiceNameChange(event.target.value)}
          />
        </div>
      )}
    </div>
  );
};

export default ToolsTab;
