// Hooks
import React from 'react';
// Icons
import { Trash2 } from 'lucide-react';
// Constants
import { MEMU_DEFAULTS } from '../../../constants';
// Types
import type { MemuSettings } from '../../../types';

type MemoryTabProps = {
  t: (key: string) => string;
  memuConfig: MemuSettings;
  handleMemuConfigChange: (
    field: keyof MemuSettings,
    value: MemuSettings[keyof MemuSettings]
  ) => void;
};

const MemoryTab: React.FC<MemoryTabProps> = ({
  t,
  memuConfig,
  handleMemuConfigChange,
}) => {
  return (
    <div className="space-y-6 max-w-xl mt-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-faint surface">
          <div className="flex-1">
            <label className="block text-base text-muted font-medium">
              {t('enableMemory')}
            </label>
            <p className="text-sm text-subtle mt-1">{t('memoryDescription')}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              handleMemuConfigChange('enabled', !memuConfig.enabled)
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              memuConfig.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--pill)]'
            }`}
            aria-pressed={memuConfig.enabled}
            aria-label={t('enableMemory')}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full toggle-thumb shadow transition-transform duration-200 ${
                memuConfig.enabled ? 'translate-x-5' : 'translate-x-1'
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
                onChange={e => handleMemuConfigChange('apiKey', e.target.value)}
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
              onChange={e => handleMemuConfigChange('baseUrl', e.target.value)}
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
                handleMemuConfigChange('autoSave', !memuConfig.autoSave)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                memuConfig.autoSave ? 'bg-[var(--accent)]' : 'bg-[var(--pill)]'
              }`}
              aria-pressed={memuConfig.autoSave}
              aria-label={t('autoSaveMemory')}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full toggle-thumb shadow transition-transform duration-200 ${
                  memuConfig.autoSave ? 'translate-x-5' : 'translate-x-1'
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
  );
};

export default MemoryTab;
