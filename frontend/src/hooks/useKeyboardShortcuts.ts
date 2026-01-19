import { useEffect, useState, useRef } from 'react';

export type ShortcutContext = 'global' | 'list' | 'message' | 'modal' | 'input';

export interface KeyboardActions {
  // Navigation
  nextItem?: () => void;
  prevItem?: () => void;
  openItem?: () => void;
  goBack?: () => void;
  firstItem?: () => void;
  lastItem?: () => void;
  
  // Actions
  delete?: () => void;
  archive?: () => void;
  reply?: () => void;
  replyAll?: () => void;
  forward?: () => void;
  markRead?: () => void;
  markUnread?: () => void;
  star?: () => void;
  
  // Global
  goToInbox?: () => void;
  goToSent?: () => void;
  goToDrafts?: () => void;
  search?: () => void;
  showHelp?: () => void;
}

export const useKeyboardShortcuts = (
  actions: KeyboardActions,
  currentContext: ShortcutContext = 'global',
  enabled: boolean = true
) => {
  const [chord, setChord] = useState<string | null>(null);
  const chordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if inside input/textarea unless it's Escape
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (isInput) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Handle Chords
      if (chord) {
        // Second key of chord
        if (chord === 'g') {
          if (e.key === 'i') actions.goToInbox?.();
          if (e.key === 's') actions.goToSent?.();
          if (e.key === 'd') actions.goToDrafts?.();
        }
        
        // Reset chord
        setChord(null);
        if (chordTimeoutRef.current) {
          clearTimeout(chordTimeoutRef.current);
          chordTimeoutRef.current = null;
        }
        e.preventDefault();
        return;
      }

      // Start Chord
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setChord('g');
        chordTimeoutRef.current = setTimeout(() => {
          setChord(null);
        }, 1000); // 1s window
        e.preventDefault();
        return;
      }

      // Single Key Shortcuts
      
      // Global / Common
      if (e.key === '?') {
        actions.showHelp?.();
      }
      if (e.key === '/') {
        e.preventDefault();
        actions.search?.();
      }

      // Navigation
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        actions.nextItem?.();
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        actions.prevItem?.();
      }
      if (e.key === 'Enter' || e.key === 'o') {
        e.preventDefault();
        actions.openItem?.();
      }
      if (e.key === 'u' || e.key === 'Escape') {
        if (actions.goBack) {
            e.preventDefault();
            actions.goBack();
        }
      }
      if (e.key === 'G' && e.shiftKey) {
         e.preventDefault();
         actions.lastItem?.();
      }

      // Actions
      if (e.key === '#') { 
         actions.delete?.();
      }
      if (e.key === 'Delete') {
         actions.delete?.();
      }
      if (e.key === 'e') actions.archive?.();
      
      // Context specific 'r'
      if (e.key === 'r') {
        if (e.shiftKey) {
            actions.markUnread?.();
        } else {
            if (currentContext === 'list') {
                actions.markRead?.();
            } else if (currentContext === 'message') {
                actions.reply?.();
            }
        }
      }

      if (e.key === 's') actions.star?.();
      if (e.key === 'a') actions.replyAll?.();
      if (e.key === 'f') actions.forward?.();
      
      // Scrolling in message view
      if (currentContext === 'message') {
          if (e.key === ' ') {
              e.preventDefault();
              const container = document.getElementById('email-body-container') || window;
              const scrollAmount = (container instanceof HTMLElement ? container.clientHeight : window.innerHeight) / 2;
              
              if (e.shiftKey) {
                  container.scrollBy(0, -scrollAmount);
              } else {
                  container.scrollBy(0, scrollAmount);
              }
          }
      }

    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, chord, currentContext, enabled]);
};
