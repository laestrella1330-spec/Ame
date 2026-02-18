import { useState, useCallback } from 'react';

export type Gender = 'male' | 'female' | 'other' | '';
export type PreferredGender = 'male' | 'female' | 'any';

export interface UserSettings {
  gender: Gender;
  preferredGender: PreferredGender;
  country: string; // ISO 3166-1 alpha-2, e.g. 'US', '' = any
}

const DEFAULT_SETTINGS: UserSettings = {
  gender: '',
  preferredGender: 'any',
  country: '',
};

function loadSettings(): UserSettings {
  try {
    const stored = localStorage.getItem('ame_settings');
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('ame_settings', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
