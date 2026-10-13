'use client';

import { useState } from 'react';

export interface SavePromptContent {
  title: string;
  message?: string;
}

interface UseMultiEntryPanelOptions {
  isOpen: boolean;
  /** Closes the panel — what "Stop" does. */
  onStop: () => void;
  /** Gets the form ready for the next entry — what "Continue" does. */
  onContinue: () => void;
}

/**
 * Multi-entry mode for a SidePanel form. The lock (off by default, reset every time the
 * panel closes) keeps the panel open through saves; each save then raises a Continue / Stop
 * prompt instead of closing. Spread `panelProps` onto <SidePanel>, and call `finishSave`
 * after a successful save in place of closing the panel.
 */
export function useMultiEntryPanel({ isOpen, onStop, onContinue }: UseMultiEntryPanelOptions) {
  const [locked, setLocked] = useState(false);
  const [prompt, setPrompt] = useState<SavePromptContent | null>(null);

  // Drop the lock once the panel is closed, so the next opening starts as a single entry.
  // Done during render rather than in an effect to avoid a cascading re-render.
  if (!isOpen && (locked || prompt)) {
    setLocked(false);
    setPrompt(null);
  }

  /** Locked → raise the Continue / Stop prompt. Unlocked → run `whenUnlocked` (the form's
   * usual close-and-celebrate path). */
  const finishSave = (content: SavePromptContent, whenUnlocked: () => void) => {
    if (locked) setPrompt(content);
    else whenUnlocked();
  };

  const panelProps = {
    lock: { locked, onToggle: () => setLocked((v) => !v) },
    savePrompt: prompt && {
      ...prompt,
      onContinue: () => {
        setPrompt(null);
        onContinue();
      },
      onStop: () => {
        setPrompt(null);
        onStop();
      },
    },
  };

  return { locked, finishSave, panelProps };
}
