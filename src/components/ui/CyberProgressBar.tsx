import React from 'react';

interface CyberProgressBarProps {
  value: number;
  max?: number;
  variant?: 'cyan' | 'red' | 'yellow' | 'purple';
  label?: string;
  showValue?: boolean;
  className?: string;
  glow?: boolean;
}

export const CyberProgressBar: React.FC<CyberProgressBarProps> = ({
  value,
  max = 100,
  variant = 'cyan',
  label,
  showValue = false,
  className = '',
  glow = true
}) => {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  
  const variants = {
    cyan: "bg-cyan-500",
    red: "bg-red-500",
    yellow: "bg-yellow-500",
    purple: "bg-purple-500",
  };

  const glowClasses = glow ? {
    cyan: "shadow-[0_0_10px_rgba(6,182,212,0.5)]",
    red: "shadow-[0_0_10px_rgba(239,68,68,0.5)]",
    yellow: "shadow-[0_0_10px_rgba(234,179,8,0.5)]",
    purple: "shadow-[0_0_10px_rgba(168,85,247,0.5)]",
  } : { cyan: '', red: '', yellow: '', purple: '' };

  const textColors = {
    cyan: "text-cyan-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
    purple: "text-purple-400",
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {(label || showValue) && (
        <div className="flex justify-between items-end font-mono text-xs uppercase tracking-widest">
          {label && <span className={textColors[variant]}>{label}</span>}
          {showValue && <span className="text-white">{Math.round(value)}/{max}</span>}
        </div>
      )}
      <div className="h-3 w-full bg-black/60 border border-neutral-800 relative overflow-hidden clip-chamfer-sm">
        <div 
          className={`h-full transition-all duration-300 ${variants[variant]} ${glowClasses[variant]}`}
          style={{ width: `${percentage}%` }}
        />
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJ0cmFuc3BhcmVudCIvPgo8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSI0IiBmaWxsPSJyZ2JhKDAsMCwwLDAuNSkiLz4KPC9zdmc+')] opacity-50 pointer-events-none"></div>
      </div>
    </div>
  );
};
