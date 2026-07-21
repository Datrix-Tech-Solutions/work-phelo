'use client';

import { useState, useSyncExternalStore } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';

const SESSION_KEY = 'mood_selector_shown';

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return sessionStorage.getItem(SESSION_KEY) === null;
}

function getServerSnapshot() {
  return false;
}

const MOODS = [
  {
    emoji: '😞',
    label: 'Very Sad',
    animationClass: 'mood-very-sad',
    baseClass: 'bg-red-100 hover:bg-red-200',
    selectedClass: 'bg-red-100 ring-2 ring-red-700',
  },
  {
    emoji: '🙁',
    label: 'Sad',
    animationClass: 'mood-sad',
    baseClass: 'bg-orange-100 hover:bg-orange-200',
    selectedClass: 'bg-orange-100 ring-2 ring-orange-700',
  },
  {
    emoji: '😐',
    label: 'Neutral',
    animationClass: 'mood-neutral',
    baseClass: 'bg-gray-100 hover:bg-gray-200',
    selectedClass: 'bg-gray-200 ring-2 ring-gray-700',
  },
  {
    emoji: '🙂',
    label: 'Happy',
    animationClass: 'mood-happy',
    baseClass: 'bg-lime-100 hover:bg-lime-200',
    selectedClass: 'bg-lime-100 ring-2 ring-lime-700',
  },
  {
    emoji: '😄',
    label: 'Very Happy',
    animationClass: 'mood-very-happy',
    baseClass: 'bg-yellow-100 hover:bg-yellow-200',
    selectedClass: 'bg-yellow-100 ring-2 ring-yellow-700',
  },
];

export function MoodSelectorModal() {
  // false on the server and the first client render (hydration-safe); React resyncs to
  // the real sessionStorage value right after hydration completes.
  const notShownYet = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [closed, setClosed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const open = notShownYet && !closed;

  const close = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setClosed(true);
  };

  const selectMood = (label: string) => {
    setSelected(label);
    useToastStore
      .getState()
      .addToast({ message: 'Thanks for sharing how you feel!', type: 'success' });
    setTimeout(close, 300);
  };

  return (
    <Modal isOpen={open} onClose={close} title="How are you feeling today?" width="max-w-lg">
      <div className="grid grid-cols-5 gap-2 mt-2">
        {MOODS.map(({ emoji, label, animationClass, baseClass, selectedClass }) => (
          <button
            key={label}
            type="button"
            onClick={() => selectMood(label)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-colors',
              selected === label ? selectedClass : baseClass,
            )}
          >
            <span className={cn('inline-block text-6xl', animationClass)}>{emoji}</span>
            <span className="text-xs font-medium text-gray-600">{label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
