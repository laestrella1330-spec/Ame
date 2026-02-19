import { useState, useCallback } from 'react';

export type Gender = 'male' | 'female' | 'other' | '';
export type PreferredGender = 'male' | 'female' | 'any';
export type EnergyLevel = 'chill' | 'normal' | 'hype' | '';
export type Intent = 'talk' | 'play' | 'flirt' | 'learn' | '';

export interface UserSettings {
  // Existing preferences
  gender: Gender;
  preferredGender: PreferredGender;
  country: string; // ISO 3166-1 alpha-2, e.g. 'US', '' = any

  // Phase 2: smart match preferences (soft — never block a match)
  energyLevel: EnergyLevel;
  intent: Intent;

  // Phase 6: privacy controls (opt-in — defaults off)
  faceBlur: boolean;
  voiceOnly: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  gender: '',
  preferredGender: 'any',
  country: '',
  energyLevel: '',
  intent: '',
  faceBlur: false,
  voiceOnly: false,
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
