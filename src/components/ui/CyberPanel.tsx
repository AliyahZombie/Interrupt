import React from 'react';

interface CyberPanelProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: 'cyan' | 'red' | 'neutral';
}

export const CyberPanel: React.FC<CyberPanelProps> = ({ 
  children, 
  className = '',
  contentClassName = '',
  variant = 'cyan'
}) => {
  const variants = {
    cyan: "border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]",
    red: "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]",
    neutral: "border-neutral-700/50"
  };

  return (
    <div
      className={`relative bg-black/80 backdrop-blur-md border ${variants[variant]} p-4 sm:p-6 md:p-8 clip-chamfer ${className}`}
    >
      {/* Subtle grid background inside panel */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}
      ></div>
      <div className={`relative z-10 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
};
