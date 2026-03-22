import React from 'react';

interface CyberBadgeProps {
  children: React.ReactNode;
  variant?: 'cyan' | 'red' | 'yellow' | 'purple' | 'neutral';
  className?: string;
  glow?: boolean;
}

export const CyberBadge: React.FC<CyberBadgeProps> = ({ 
  children, 
  variant = 'cyan', 
  className = '',
  glow = false
}) => {
  const variants = {
    cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
    red: "bg-red-500/20 text-red-400 border-red-500/50",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/50",
    neutral: "bg-neutral-500/20 text-neutral-400 border-neutral-500/50",
  };

  const glowClasses = glow ? (
    variant === 'cyan' ? 'shadow-[0_0_10px_rgba(6,182,212,0.5)]' :
    variant === 'red' ? 'shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
    variant === 'yellow' ? 'shadow-[0_0_10px_rgba(234,179,8,0.5)]' :
    variant === 'purple' ? 'shadow-[0_0_10px_rgba(168,85,247,0.5)]' : ''
  ) : '';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 border font-mono text-xs font-bold uppercase tracking-wider clip-chamfer-sm ${variants[variant]} ${glowClasses} ${className}`}>
      {children}
    </span>
  );
};
