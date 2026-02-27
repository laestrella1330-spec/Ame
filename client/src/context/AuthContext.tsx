import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { App } from '@capacitor/app';
import { userGet, userPost } from '../services/api';
import { disconnectSocket } from '../services/socket';

export interface AuthUser {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  hasAcceptedConsent: boolean;
  activeBan: {
    reason: string | null;
    expiresAt: string;
    remainingDays: number;
    banNumber: number;
  } | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, user: Partial<AuthUser>) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setConsentAccepted: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('user_token');
    if (!token) { setUser(null); setIsLoading(false); return; }
    try {
      const me = await userGet<AuthUser>('/users/me');
      // If the server reports an active ban, treat the session as invalid:
      // store ban info for the login screen, clear the token, and log out.
      if (me.activeBan) {
        sessionStorage.setItem('banned_reason', me.activeBan.reason ?? 'Violation of Terms of Service');
        sessionStorage.setItem('banned_days', String(me.activeBan.remainingDays ?? 0));
        localStorage.removeItem('user_token');
        disconnectSocket();
        // Hard redirect — works from any page (landing, chat, etc.), not just ChatPage
        window.location.replace('/login');
        return;
      } else {
        setUser(me);
      }
    } catch (err: unknown) {
      // Check if server explicitly rejected with account_banned
      const e = err as { status?: number; data?: Record<string, unknown> };
      if (e.status === 403 && e.data?.error === 'account_banned') {
        sessionStorage.setItem('banned_reason', String(e.data.reason ?? 'Violation of Terms of Service'));
        sessionStorage.setItem('banned_days', String(e.data.remainingDays ?? 0));
        localStorage.removeItem('user_token');
        disconnectSocket();
        window.location.replace('/login');
        return;
      }
      // Token invalid/expired — clear it
      localStorage.removeItem('user_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Rehydrate on mount
  useEffect(() => { refreshUser(); }, [refreshUser]);

  // Re-check ban status whenever the user returns to this tab or window,
  // and on a 60-second heartbeat. This ensures a ban applied by an admin
  // takes effect promptly even if the socket did not deliver a kick event.
  useEffect(() => {
    const check = () => { if (localStorage.getItem('user_token')) refreshUser(); };

    const handleVisibility = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', check);
    const interval = setInterval(check, 15_000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', check);
      clearInterval(interval);
    };
  }, [refreshUser]);

  // Handle Facebook OAuth deep link on Android (Capacitor appUrlOpen event)
  useEffect(() => {
    const listenerPromise = App.addListener('appUrlOpen', (data) => {
      // data.url = "com.ame.videochat://#facebook-auth-success?token=..."
      const fragment = data.url.split('#')[1];
      if (!fragment) return;
      if (fragment.includes('facebook-auth-success')) {
        const params = new URLSearchParams(fragment.split('?')[1] ?? '');
        const token = params.get('token');
        if (token) {
          localStorage.setItem('user_token', token);
          refreshUser();
        }
      } else if (fragment.includes('auth-error=banned')) {
        const params = new URLSearchParams(fragment.split('?')[1] ?? '');
        sessionStorage.setItem('banned_reason', params.get('reason') ?? 'TOS violation');
        sessionStorage.setItem('banned_days', params.get('days') ?? '0');
        refreshUser();
      }
    });
    return () => { listenerPromise.then(h => h.remove()); };
  }, [refreshUser]);

  // Handle Facebook OAuth token in URL hash on app load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('facebook-auth-success')) {
      const params = new URLSearchParams(hash.split('?')[1]);
      const token = params.get('token');
      const _displayName = params.get('displayName') ?? '';
      const _userId = params.get('userId') ?? '';
      void _displayName; void _userId; // present in hash but not needed — server profile is fetched via refreshUser
      if (token) {
        localStorage.setItem('user_token', token);
        // Clear hash and refresh user from server
        window.history.replaceState(null, '', window.location.pathname);
        refreshUser();
      }
    }
    // Handle ban error from Facebook callback
    if (hash.includes('auth-error=banned')) {
      const params = new URLSearchParams(hash.split('?')[1] ?? hash.split('=').slice(1).join('='));
      const reason = params.get('reason') ?? 'TOS violation';
      const days = params.get('days') ?? '0';
      window.history.replaceState(null, '', window.location.pathname);
      // Store ban info for display
      sessionStorage.setItem('banned_reason', reason);
      sessionStorage.setItem('banned_days', days);
    }
  }, [refreshUser]);

  // After any login (email, phone, or Facebook), submit the DOB captured by AgeGatePage.
  // This is a no-op for existing users who already have a DOB stored.
  useEffect(() => {
    if (!user) return;
    const pendingDob = localStorage.getItem('pending_dob');
    if (!pendingDob) return;
    userPost('/users/me/dob', { dob: pendingDob })
      .then(() => localStorage.removeItem('pending_dob'))
      .catch(() => { /* silent — server-side DOB is best-effort; form paths already sent it */ });
  }, [user?.id]);

  const login = useCallback((token: string, partial: Partial<AuthUser>) => {
    localStorage.setItem('user_token', token);
    // Immediately set partial data, then fetch full profile
    setUser({
      id: partial.id ?? '',
      displayName: partial.displayName ?? '',
      email: partial.email ?? null,
      phone: partial.phone ?? null,
      hasAcceptedConsent: false,
      activeBan: null,
    });
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(() => {
    localStorage.removeItem('user_token');
    disconnectSocket();
    setUser(null);
  }, []);

  const setConsentAccepted = useCallback(() => {
    setUser((prev) => prev ? { ...prev, hasAcceptedConsent: true } : prev);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser, setConsentAccepted }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
