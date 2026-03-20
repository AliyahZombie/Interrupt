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
  const baseClasses = "relative px-6 py-3 font-mono font-bold uppercase tracking-widest transition-all duration-200 overflow-hidden clip-chamfer";
  
  const variants = {
    primary: "bg-cyan-500/20 text-cyan-400 border border-cyan-400 hover:bg-cyan-400 hover:text-black border-glow-cyan",
    danger: "bg-red-500/20 text-red-400 border border-red-400 hover:bg-red-500 hover:text-black border-glow-red",
    ghost: "bg-transparent text-neutral-400 hover:text-white hover:bg-white/5"
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
