import { useColorScheme } from 'react-native';
import { lightColors, darkColors, type Colors } from './colors';
import { useSettings } from '../contexts/SettingsContext';

function resolveScheme(
  preference: 'system' | 'light' | 'dark',
  systemScheme: 'light' | 'dark' | null | undefined
): 'light' | 'dark' {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function useColors(): Colors {
  const systemScheme = useColorScheme();
  const { settings } = useSettings();
  const scheme = resolveScheme(settings.themePreference, systemScheme);
  return scheme === 'dark' ? darkColors : lightColors;
}

export function useIsDark(): boolean {
  const systemScheme = useColorScheme();
  const { settings } = useSettings();
  return resolveScheme(settings.themePreference, systemScheme) === 'dark';
}
