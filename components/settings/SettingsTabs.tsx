import React, { memo } from 'react';

export type SettingsTabId =
  | 'general'
  | 'provider'
  | 'tools'
  | 'memory'
  | 'profile'
  | 'data'
  | 'about';

type TabIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export interface TabConfig {
  readonly id: SettingsTabId;
  readonly label: string;
  readonly icon: TabIcon;
}

interface SettingsTabsProps {
  readonly tabs: ReadonlyArray<TabConfig>;
  readonly activeTab: SettingsTabId;
  readonly onTabChange: (tabId: SettingsTabId) => void;
  readonly title: string;
}

/**
 * Settings sidebar tab navigation component
 * 设置侧边栏标签导航组件
 */
const SettingsTabs: React.FC<SettingsTabsProps> = memo(
  ({ tabs, activeTab, onTabChange, title }) => {
    return (
      <div className="w-full md:w-64 surface-ghost p-4 md:p-6 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible flex-shrink-0 h-full">
        <h2 className="text-lg md:text-xl font-semibold text-muted mb-0 md:mb-6 hidden md:block">
          {title}
        </h2>

        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
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
    );
  }
);

SettingsTabs.displayName = 'SettingsTabs';

export default SettingsTabs;
