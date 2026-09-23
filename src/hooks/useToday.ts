import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { today } from '../utils/date';

// today() as React state, so screens follow the date when it changes while
// they stay mounted: at local midnight, and when the app returns to the
// foreground on a later day.
export function useToday(): string {
  const [value, setValue] = useState(today);

  useEffect(() => {
    const refresh = () => setValue(today());

    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, nextDay.getTime() - now.getTime() + 1000);
    };
    scheduleMidnight();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return value;
}
