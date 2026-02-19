/**
 * FeaturesContext
 *
 * Fetches /api/features once on mount and makes flags available throughout
 * the app. All flags default to false — the app works normally with none.
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { userGet } from '../services/api';

export interface FeatureFlags {
  aiWarmup: boolean;
  smartMatch: boolean;
  aiCohost: boolean;
  aiSafety: boolean;
  postChatFeedback: boolean;
  identityControls: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  aiWarmup: false,
  smartMatch: false,
  aiCohost: false,
  aiSafety: false,
  postChatFeedback: false,
  identityControls: false,
};

const FeaturesContext = createContext<FeatureFlags>(DEFAULT_FLAGS);

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);

  useEffect(() => {
    userGet<FeatureFlags>('/features')
      .then((f) => setFlags({ ...DEFAULT_FLAGS, ...f }))
      .catch(() => { /* keep defaults on error */ });
  }, []);

  return (
    <FeaturesContext.Provider value={flags}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures(): FeatureFlags {
  return useContext(FeaturesContext);
}
