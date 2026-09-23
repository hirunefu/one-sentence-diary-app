import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Mirrors the OS "reduce motion" preference (Android: Settings >
// Accessibility > Remove animations). Components skip decorative motion and
// jump straight to the end state while it is on.
//
// The last known value is kept at module scope so screens mounted later
// start from it instead of animating once before the async query resolves.
let lastKnown = false;

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(lastKnown);

  useEffect(() => {
    let active = true;
    const update = (enabled: boolean) => {
      lastKnown = enabled;
      if (active) setReduceMotion(enabled);
    };
    AccessibilityInfo.isReduceMotionEnabled().then(update, () => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}
