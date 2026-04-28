import { useColorScheme } from 'react-native';
import { lightColors, darkColors, type Colors } from './colors';

export function useColors(): Colors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
