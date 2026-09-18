import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon } from './Icons';

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  avatarUrl?: string | null;
  initials?: string;
  badge?: string;
  badgeType?: 'owner' | 'admin' | 'member' | 'default';
  description?: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
  align?: 'left' | 'right';
  fullWidth?: boolean;
  id?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  label,
  error,
  helperText,
  required,
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  size = 'md',
  compact = false,
  align = 'left',
  fullWidth = true,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div
      className={`c-select-wrapper ${fullWidth ? 'w-full' : ''} ${className}`}
      ref={containerRef}
      id={selectId}
    >
      {label && (
        <label className="c-select-label">
          {label}
          {required && <span className="c-select-required">*</span>}
        </label>
      )}

      <div className="c-select-relative">
        <button
          type="button"
          className={`c-select-trigger size-${size} ${compact ? 'is-compact' : ''} ${
            isOpen ? 'is-open' : ''
          } ${error ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''} ${triggerClassName}`}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="c-select-trigger-left">
            {selectedOption ? (
              <>
                {selectedOption.avatarUrl ? (
                  <img src={selectedOption.avatarUrl} alt="" className="c-select-avatar" />
                ) : selectedOption.initials ? (
                  <span className="c-select-initials">{selectedOption.initials}</span>
                ) : selectedOption.icon ? (
                  <span
                    className={`c-select-icon-box ${
                      !selectedOption.iconBg || selectedOption.iconBg === 'transparent'
                        ? 'is-plain'
                        : ''
                    }`}
                    style={{
                      backgroundColor: selectedOption.iconBg || 'transparent',
                      color: selectedOption.iconColor || 'inherit',
                    }}
                  >
                    {selectedOption.icon}
                  </span>
                ) : null}

                <span className="c-select-value-text">{selectedOption.label}</span>
              </>
            ) : (
              <span className="c-select-placeholder">{placeholder}</span>
            )}
          </div>

          <ChevronDownIcon
            size={size === 'sm' ? 14 : 16}
            className={`c-select-chevron ${isOpen ? 'open' : ''}`}
          />
        </button>

        {isOpen && (
          <div
            className={`c-select-menu align-${align} ${menuClassName}`}
            role="listbox"
          >
            {options.length === 0 ? (
              <div className="c-select-empty">No options</div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    className={`c-select-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="c-select-item-left">
                      {opt.avatarUrl ? (
                        <img src={opt.avatarUrl} alt="" className="c-select-avatar-item" />
                      ) : opt.initials ? (
                        <span className="c-select-initials-item">{opt.initials}</span>
                      ) : opt.icon ? (
                        <span
                          className="c-select-badge"
                          style={{
                            backgroundColor: opt.iconBg || '#F3F4F6',
                            color: opt.iconColor || '#374151',
                          }}
                        >
                          {opt.icon}
                        </span>
                      ) : null}

                      <div className="c-select-item-text">
                        <span className="c-select-item-label">{opt.label}</span>
                        {opt.description && (
                          <span className="c-select-item-desc">{opt.description}</span>
                        )}
                      </div>
                    </div>

                    <div className="c-select-item-right">
                      {opt.badge && (
                        <span
                          className={`c-select-role-pill ${
                            opt.badgeType ? `role-${opt.badgeType}` : ''
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <span className="c-select-check">
                          <CheckIcon size={16} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {error && <span className="c-select-error-msg">{error}</span>}
      {!error && helperText && <span className="c-select-helper-msg">{helperText}</span>}
    </div>
  );
};
