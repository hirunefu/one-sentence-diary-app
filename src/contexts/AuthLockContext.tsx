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
