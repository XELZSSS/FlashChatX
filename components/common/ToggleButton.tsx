import React, { memo } from 'react';

interface ToggleButtonProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly label: string;
  readonly icon: React.ElementType;
  readonly title?: string;
  readonly disabled?: boolean;
}

const ToggleButton: React.FC<ToggleButtonProps> = memo(
  ({ active, onClick, label, icon: Icon, title, disabled = false }) => {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`feature-toggle flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
          active
            ? 'bg-[var(--accent-soft)] border-[var(--accent-soft)] text-[var(--accent)]'
            : 'surface border text-subtle hover:bg-[var(--panel-strong)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-pressed={active}
        title={title || label}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </button>
    );
  }
);

ToggleButton.displayName = 'ToggleButton';

export default ToggleButton;
