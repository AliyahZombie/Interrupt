import React, { useId, useMemo } from 'react';

interface CyberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
}

export const CyberInput: React.FC<CyberInputProps> = ({ 
  label, 
  error, 
  className = '', 
  ...props 
}) => {
  const reactId = useId();
  const sanitizedId = useMemo(() => reactId.replace(/[^a-zA-Z0-9_-]/g, ''), [reactId]);
  const { id: providedId, className: inputClassName = '', ...inputProps } = props;
  const inputId = providedId ?? `cyber-input-${sanitizedId}`;
  const errorId = `${inputId}-error`;
  const describedBy = [inputProps['aria-describedby'], error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const isInvalid = Boolean(error) || inputProps['aria-invalid'] === true;

  const inputClasses = [
    'w-full bg-black/50 text-white font-mono px-4 py-2 clip-chamfer-sm',
    'border transition-[border-color,box-shadow,background-color,opacity] duration-150 ease-out',
    'focus:outline-none',
    'motion-reduce:transition-none',
    error
      ? 'border-red-500/60 focus:border-red-400 focus:shadow-[0_0_10px_rgba(239,68,68,0.25)]'
      : 'border-cyan-500/30 focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)]',
    inputClassName,
  ].join(' ');

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label
          className={`font-mono text-xs uppercase tracking-widest ${error ? 'text-red-400' : 'text-cyan-400'}`}
          htmlFor={inputId}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input 
          id={inputId}
          aria-invalid={isInvalid}
          aria-describedby={describedBy}
          className={inputClasses}
          {...inputProps}
        />
        {/* Decorative corner accents */}
        <div
          className={`absolute top-0 right-0 w-2 h-2 pointer-events-none ${error ? 'bg-red-500/60' : 'bg-cyan-500/50'}`}
        ></div>
        <div
          className={`absolute bottom-0 left-0 w-2 h-2 pointer-events-none ${error ? 'bg-red-500/60' : 'bg-cyan-500/50'}`}
        ></div>
      </div>
      {error && (
        <span id={errorId} className="font-mono text-xs text-red-500 mt-1">
          {error}
        </span>
      )}
    </div>
  );
};
