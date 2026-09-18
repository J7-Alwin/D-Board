import React, { forwardRef, useId } from 'react';
import { CheckIcon } from './Icons';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  label,
  error,
  id,
  className = '',
  checked,
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="checkbox-group">
      <label htmlFor={inputId} className="checkbox-label">
        <div className="checkbox-box-wrapper">
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            className={`checkbox-native ${className}`}
            checked={checked}
            {...props}
          />
          <div className="checkbox-custom" aria-hidden="true">
            <CheckIcon size={12} className="checkbox-check" />
          </div>
        </div>
        {label && <span className="checkbox-text">{label}</span>}
      </label>
      {error && <p className="input-error-msg" role="alert">{error}</p>}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';
