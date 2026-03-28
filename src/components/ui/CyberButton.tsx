import React from 'react';

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost';
  children: React.ReactNode;
}

export const CyberButton: React.FC<CyberButtonProps> = ({ 
  variant = 'primary', 
  children, 
  className = '', 
  ...props 
}) => {
  const baseClasses = [
    'relative px-6 py-3 font-mono font-bold uppercase tracking-widest overflow-hidden clip-chamfer',
    'transition-[transform,background-color,color,box-shadow,border-color,opacity,filter] duration-150 ease-out',
    'active:translate-y-px active:scale-[0.99]',
    'focus-visible:outline-none',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    'motion-reduce:transition-none motion-reduce:transform-none',
  ].join(' ');
   
  const variants = {
    primary: [
      'bg-cyan-500/15 text-cyan-300 border border-cyan-400/70',
      'hover:bg-cyan-400 hover:text-black',
      'focus-visible:border-cyan-300 focus-visible:shadow-[0_0_0_2px_rgba(6,182,212,0.35),0_0_16px_rgba(6,182,212,0.25)]',
      'border-glow-cyan',
    ].join(' '),
    danger: [
      'bg-red-500/15 text-red-300 border border-red-400/70',
      'hover:bg-red-500 hover:text-black',
      'focus-visible:border-red-300 focus-visible:shadow-[0_0_0_2px_rgba(239,68,68,0.35),0_0_16px_rgba(239,68,68,0.25)]',
      'border-glow-red',
    ].join(' '),
    ghost: [
      'bg-transparent text-neutral-300 border border-white/10',
      'hover:text-white hover:bg-white/5',
      'focus-visible:border-white/30 focus-visible:shadow-[0_0_0_2px_rgba(255,255,255,0.18)]',
    ].join(' '),
  };

  return (
    <button 
      className={`${baseClasses} ${variants[variant]} ${className}`}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      {/* Scanline overlay for the button */}
      <div className="absolute inset-0 bg-scanlines opacity-20 pointer-events-none"></div>
    </button>
  );
};
