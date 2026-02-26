import { useEffect } from 'react';

/**
 * ThemeProvider — applies 'light' class to <html> when theme is 'light'.
 * Listens for the 'ame-settings-update' custom event so it stays in sync
 * with whichever component calls updateSettings(), without needing a shared
 * state instance.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const applyTheme = (theme: string) => {
      if (theme === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
    };

    // Apply theme from localStorage on mount
    try {
      const stored = localStorage.getItem('ame_settings');
      const parsed = JSON.parse(stored || '{}');
      applyTheme(parsed.theme || 'dark');
    } catch {
      // ignore
    }

    // Stay in sync whenever settings are updated anywhere in the app
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      applyTheme(detail?.theme || 'dark');
    };
    window.addEventListener('ame-settings-update', handler);
    return () => window.removeEventListener('ame-settings-update', handler);
  }, []);

  return <>{children}</>;
}
