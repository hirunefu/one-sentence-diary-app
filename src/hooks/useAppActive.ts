import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// False while the app is in the background, so nothing that needs to be seen
// (like a full-screen celebration) starts where nobody can see it.
export function useAppActive(): boolean {
  const [active, setActive] = useState(() => AppState.currentState !== 'background');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state !== 'background'));
    return () => sub.remove();
  }, []);

  return active;
}
