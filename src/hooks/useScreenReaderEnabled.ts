import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Whether a screen reader (TalkBack) is on, following later changes. Mirrors
// useReduceMotion, including the module-scope last known value.
let lastKnown = false;

export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(lastKnown);

  useEffect(() => {
    let active = true;
    const update = (on: boolean) => {
      lastKnown = on;
      if (active) setEnabled(on);
    };
    AccessibilityInfo.isScreenReaderEnabled().then(update, () => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', update);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return enabled;
}
