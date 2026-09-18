import React from 'react';
import { CustomSelect, type CustomSelectOption } from './CustomSelect';

export type Option = CustomSelectOption;

export interface SelectProps {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement> | any) => void;
  options: Option[];
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
  align?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value = '',
  onChange,
  options,
  error,
  helperText,
  required,
  disabled,
  className = '',
  id,
  placeholder,
  size,
  compact,
  align,
  fullWidth,
}) => {
  const handleChange = (val: string) => {
    if (onChange) {
      // Support both event-like structure and direct value
      const synthEvent = {
        target: { value: val, id, name: id },
        currentTarget: { value: val, id, name: id },
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      onChange(synthEvent);
    }
  };

  return (
    <CustomSelect
      id={id}
      label={label}
      value={value}
      onChange={handleChange}
      options={options}
      error={error}
      helperText={helperText}
      required={required}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      size={size}
      compact={compact}
      align={align}
      fullWidth={fullWidth}
    />
  );
};

