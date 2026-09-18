import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  required,
  className = '',
  id,
  rows = 4,
  ...props
}) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`input-group ${className}`}>
      {label && (
        <label htmlFor={textareaId} className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}

      <div className={`input-wrapper ${error ? 'has-error' : ''}`}>
        <textarea
          id={textareaId}
          rows={rows}
          className="input-field"
          style={{ resize: 'vertical', minHeight: '5rem' }}
          aria-invalid={!!error}
          aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
          {...props}
        />
      </div>

      {error && (
        <span id={`${textareaId}-error`} className="input-error-msg" role="alert">
          {error}
        </span>
      )}

      {!error && helperText && (
        <span id={`${textareaId}-helper`} className="input-helper-msg">
          {helperText}
        </span>
      )}
    </div>
  );
};
