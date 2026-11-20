/**
 * Keyboard Navigation Component for P2P Music Platform
 * Provides proper keyboard navigation with focus trapping and management
 */

import React, { useEffect, useRef, useCallback } from 'react';

interface KeyboardNavProps {
  children: React.ReactNode;
  trapFocus?: boolean;
  autoFocus?: boolean;
  onEscape?: () => void;
  className?: string;
}

export const KeyboardNavigation: React.FC<KeyboardNavProps> = ({
  children,
  trapFocus = false,
  autoFocus = false,
  onEscape,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Get all focusable elements
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    return Array.from(
      containerRef.current.querySelectorAll(focusableSelectors)
    ).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && el.offsetParent !== null
    );
  }, []);

  // Handle tab key for focus trapping
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Tab') {
        if (e.key === 'Escape' && onEscape) {
          onEscape();
        }
        return;
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: moving backwards
        if (document.activeElement === firstElement) {
          if (trapFocus) {
            e.preventDefault();
            lastElement.focus();
          }
        }
      } else {
        // Tab: moving forwards
        if (document.activeElement === lastElement) {
          if (trapFocus) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [trapFocus, getFocusableElements, onEscape]
  );

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown);

    // Auto focus first element
    if (autoFocus) {
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        const timer = setTimeout(() => {
          focusableElements[0].focus();
        }, 100);
        return () => {
          clearTimeout(timer);
          container.removeEventListener('keydown', handleKeyDown);
        };
      }
    }

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [autoFocus, handleKeyDown, getFocusableElements]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

export default KeyboardNavigation;
