import React, { useEffect, useId, useRef, useState } from 'react';
import { CyberPanel } from './CyberPanel';
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
  const titleId = useId();
  const [isMounted, setIsMounted] = useState(isOpen);
  const closeTimeoutRef = useRef<number | null>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const bodyOverflowRef = useRef<string | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (!isMounted) return;

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMounted, onClose]);

  useEffect(() => {
    if (isOpen) {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setIsMounted(true);
      return;
    }

    if (!isMounted) return;

    closeTimeoutRef.current = window.setTimeout(() => {
      setIsMounted(false);
    }, 200);

    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [isOpen, isMounted]);

  useEffect(() => {
    if (!isMounted) {
      if (bodyOverflowRef.current !== null) {
        document.body.style.overflow = bodyOverflowRef.current;
        bodyOverflowRef.current = null;
      }
      lastActiveRef.current?.focus();
      return;
    }

    if (!isOpen) return;

    if (bodyOverflowRef.current === null) {
      bodyOverflowRef.current = document.body.style.overflow;
    }
    document.body.style.overflow = 'hidden';

    const activeEl = document.activeElement;
    lastActiveRef.current = activeEl instanceof HTMLElement ? activeEl : null;

    const raf = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [isMounted, isOpen]);

  if (!isMounted) return null;

  const backdropClasses = [
    'fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm',
    'transition-opacity duration-200 ease-out motion-reduce:transition-none',
    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
  ].join(' ');

  const panelWrapClasses = [
    'relative w-full max-w-lg max-h-[calc(100svh-2rem)]',
    'transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none',
    isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95',
  ].join(' ');

  return (
    <div
      className={backdropClasses}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-scanlines opacity-20 pointer-events-none"></div>

      <div className="absolute inset-0 p-4 flex items-center justify-center">
        <div
          className={panelWrapClasses}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <CyberPanel
            variant={variant}
            className="max-h-[calc(100svh-2rem)]"
            contentClassName="flex flex-col max-h-[calc(100svh-2rem)]"
          >
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <CyberText id={titleId} variant="h3" color={variant === 'neutral' ? 'white' : variant} glow>
                {title}
              </CyberText>
              <button 
                onClick={onClose}
                ref={closeButtonRef}
                aria-label="Close modal"
                className="text-white/60 hover:text-white transition-[color,transform] duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none font-mono text-xl leading-none focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(255,255,255,0.18)] active:translate-y-px"
              >
                ×
              </button>
            </div>
            
            <div className="text-neutral-300 font-sans overflow-y-auto min-h-0 pr-2 custom-scrollbar">
              {children}
            </div>
            
            {actions && (
              <div className="flex justify-end gap-4 pt-4 border-t border-white/10 shrink-0">
                {actions}
              </div>
            )}
          </CyberPanel>
        </div>
      </div>
    </div>
  );
};
