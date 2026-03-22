import React from 'react';

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
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="font-mono text-xs uppercase tracking-widest text-cyan-400">
          {label}
        </label>
      )}
      <div className="relative">
        <input 
          className="w-full bg-black/50 border border-cyan-500/30 text-white font-mono px-4 py-2 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all clip-chamfer-sm"
          {...props}
        />
        {/* Decorative corner accents */}
        <div className="absolute top-0 right-0 w-2 h-2 bg-cyan-500/50 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 bg-cyan-500/50 pointer-events-none"></div>
      </div>
      {error && (
        <span className="font-mono text-xs text-red-500 mt-1">
          {error}
        </span>
      )}
    </div>
  );
};
