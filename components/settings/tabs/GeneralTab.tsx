// Hooks
import React from 'react';
// Icons
import { Check } from 'lucide-react';
// Types
import type { Theme, ExtendedUserSettings } from '../../../types';

type ThemeOption = {
  value: Theme;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

type GeneralTabProps = {
  t: (key: string) => string;
  settings: ExtendedUserSettings;
  themeOptions: ThemeOption[];
  supportedLanguages: readonly string[];
  dropdownStates: { language: boolean };
  languageRef: React.RefObject<HTMLDivElement>;
  toggleDropdown: (key: 'language') => void;
  closeDropdown: (key: 'language') => void;
  handleThemeChange: (theme: Theme) => void;
  handleLanguageChange: (language: string) => void;
};

const GeneralTab: React.FC<GeneralTabProps> = ({
  t,
  settings,
  themeOptions,
  supportedLanguages,
  dropdownStates,
  languageRef,
  toggleDropdown,
  closeDropdown,
  handleThemeChange,
  handleLanguageChange,
}) => {
  return (
    <div className="space-y-8 md:space-y-10 max-w-xl">
      {/* Theme Section */}
      <div className="space-y-4">
        <label className="block text-base text-subtle">{t('theme')}</label>
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
      <div className="space-y-4 relative z-20" ref={languageRef}>
        <label className="block text-base text-subtle">{t('language')}</label>
        <div className="relative w-full sm:w-64">
          <button
            onClick={() => toggleDropdown('language')}
            className="lang-trigger w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-base font-medium transition-colors"
          >
            <span>{settings.language}</span>
          </button>

          {dropdownStates.language && (
            <div className="absolute top-full right-0 mt-2 w-64 surface rounded-xl shadow-soft border-faint max-h-60 md:max-h-80 overflow-y-auto overflow-x-hidden py-1.5 scrollbar-thin z-50">
              {supportedLanguages.map(lang => {
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
                    {isSelected && <Check className="w-4 h-4 text-muted" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneralTab;
