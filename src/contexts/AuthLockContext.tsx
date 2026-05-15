import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSettings } from './SettingsContext';

type AuthLockContextValue = {
  isLocked: boolean;
  unlock: () => void;
};

const AuthLockContext = createContext<AuthLockContextValue | null>(null);

export function AuthLockProvider({ children }: { children: React.ReactNode }) {
  const { settings, ready } = useSettings();
  const [isLocked, setIsLocked] = useState(false);
  // The AppState listener below is registered once and captures variables
  // by closure, so reading settings.lockEnabled directly would always see
  // the initial value (stale closure). Route through a ref so the listener
  // can read the latest value at event time.
  const lockEnabledRef = useRef(settings.lockEnabled);

  useEffect(() => {
    lockEnabledRef.current = settings.lockEnabled;
  }, [settings.lockEnabled]);

  useEffect(() => {
    if (ready) {
      setIsLocked(settings.lockEnabled);
    }
  }, [ready, settings.lockEnabled]);

  useEffect(() => {
    // Re-lock on foreground: beyond hiding the home screen while backgrounded
    // (with Lock enabled), require reauthentication every time the app comes
    // forward so a second person who picks up the device can't see entries.
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && lockEnabledRef.current) {
        setIsLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(() => setIsLocked(false), []);

  const value = useMemo(() => ({ isLocked, unlock }), [isLocked, unlock]);

  return (
    <AuthLockContext.Provider value={value}>{children}</AuthLockContext.Provider>
  );
}

export function useAuthLock(): AuthLockContextValue {
  const v = useContext(AuthLockContext);
  if (!v) throw new Error('useAuthLock must be used within AuthLockProvider');
  return v;
}
