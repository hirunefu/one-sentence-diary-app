import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

// Whether the soft keyboard is up. Follows the keyboard rather than input
// focus: on Android the input can keep focus after Back hides the keyboard.
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return shown;
}
