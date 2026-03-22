import React from 'react';

interface CyberGlitchTextProps {
  text: string;
  className?: string;
  color?: 'cyan' | 'red' | 'white';
}

export const CyberGlitchText: React.FC<CyberGlitchTextProps> = ({ 
  text, 
  className = '',
  color = 'cyan'
}) => {
  const colors = {
    cyan: "text-cyan-400",
    red: "text-red-500",
    white: "text-white",
  };

  const shadowColors = {
    cyan: { s1: '#06b6d4', s2: '#ef4444' }, // Cyan with red glitch
    red: { s1: '#ef4444', s2: '#06b6d4' }, // Red with cyan glitch
    white: { s1: '#ffffff', s2: '#06b6d4' }, // White with cyan glitch
  };

  const s1 = shadowColors[color].s1;
  const s2 = shadowColors[color].s2;

  return (
    <div className={`relative inline-block font-sans font-bold uppercase tracking-tighter ${colors[color]} ${className}`}>
      <span className="relative z-10">{text}</span>
      <span 
        className="absolute top-0 left-[2px] -z-10 opacity-70"
        style={{ 
          color: s1, 
          animation: 'glitch-anim-1 2.5s infinite linear alternate-reverse' 
        }}
        aria-hidden="true"
      >
        {text}
      </span>
      <span 
        className="absolute top-0 -left-[2px] -z-10 opacity-70"
        style={{ 
          color: s2, 
          animation: 'glitch-anim-2 3s infinite linear alternate-reverse' 
        }}
        aria-hidden="true"
      >
        {text}
      </span>
    </div>
  );
};
