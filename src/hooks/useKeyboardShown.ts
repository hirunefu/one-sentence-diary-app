import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

// Whether the soft keyboard is up. Follows the keyboard rather than input
// focus: on Android the input can keep focus after Back hides the keyboard.
// `beforeChange` runs just before the value changes, e.g. to set up a layout
// animation for what the change moves.
export function useKeyboardShown(beforeChange?: () => void): boolean {
  const [shown, setShown] = useState(() => Keyboard.isVisible());
  const beforeChangeRef = useRef(beforeChange);
  useLayoutEffect(() => {
    beforeChangeRef.current = beforeChange;
  });

  useEffect(() => {
    const change = (next: boolean) => () => {
      beforeChangeRef.current?.();
      setShown(next);
    };
    const show = Keyboard.addListener('keyboardDidShow', change(true));
    const hide = Keyboard.addListener('keyboardDidHide', change(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return shown;
}
