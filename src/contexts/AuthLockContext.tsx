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
  // AppState listener は一度しか登録しないクロージャなので、
  // settings.lockEnabled を直接参照すると常に初期値で評価される (stale closure)。
  // ref を経由して最新値を読みに行く。
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
    // フォアグラウンド復帰時に再ロックする理由:
    // バックグラウンド中はホーム画面に内容が残らない (Lock 設定 ON 時) ことに加えて、
    // 一度離席してから戻ってきた第三者にデータを見せないため、毎回認証を要求する。
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
