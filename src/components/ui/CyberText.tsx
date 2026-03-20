import React from 'react';

interface CyberTextProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'label';
  color?: 'cyan' | 'red' | 'white' | 'neutral';
  className?: string;
  glow?: boolean;
}

export const CyberText: React.FC<CyberTextProps> = ({
  children,
  variant = 'body',
  color = 'white',
  className = '',
  glow = false
}) => {
  const variants = {
    h1: "font-sans text-5xl md:text-7xl font-bold uppercase tracking-tighter",
    h2: "font-sans text-3xl md:text-4xl font-bold uppercase tracking-tight",
    h3: "font-mono text-xl md:text-2xl font-bold uppercase tracking-widest",
    body: "font-sans text-base md:text-lg",
    label: "font-mono text-xs md:text-sm uppercase tracking-widest opacity-80"
  };

  const colors = {
    cyan: "text-cyan-400",
    red: "text-red-500",
    white: "text-white",
    neutral: "text-neutral-400"
  };

  const glowClasses = glow ? (color === 'cyan' ? 'text-glow-cyan' : color === 'red' ? 'text-glow-red' : '') : '';

  return (
    <div className={`${variants[variant]} ${colors[color]} ${glowClasses} ${className}`}>
      {children}
    </div>
  );
};
