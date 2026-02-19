import { useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';

/**
 * ThemeProvider — applies 'light' class to <html> when theme is 'light'.
 * Dark is the default (no class needed).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();

  useEffect(() => {
    if (settings.theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [settings.theme]);

  return <>{children}</>;
}
