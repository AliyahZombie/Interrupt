import React, { useEffect } from 'react';
import { CyberPanel } from './CyberPanel';
import { CyberButton } from './CyberButton';
import { CyberText } from './CyberText';

interface CyberModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  variant?: 'cyan' | 'red' | 'neutral';
  actions?: React.ReactNode;
}

export const CyberModal: React.FC<CyberModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  variant = 'cyan',
  actions
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-scanlines opacity-20 pointer-events-none"></div>
      
      <div className="relative w-full max-w-lg animate-in zoom-in-95 duration-200">
        <CyberPanel variant={variant} className="flex flex-col gap-6">
          <div className="flex justify-between items-start border-b border-white/10 pb-4">
            <CyberText variant="h3" color={variant === 'neutral' ? 'white' : variant} glow>
              {title}
            </CyberText>
            <button 
              onClick={onClose}
              className="text-white/50 hover:text-white transition-colors font-mono text-xl leading-none"
            >
              ×
            </button>
          </div>
          
          <div className="text-neutral-300 font-sans">
            {children}
          </div>
          
          {actions && (
            <div className="flex justify-end gap-4 pt-4 border-t border-white/10">
              {actions}
            </div>
          )}
        </CyberPanel>
      </div>
    </div>
  );
};
