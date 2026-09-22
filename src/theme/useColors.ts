import { useColorScheme, type ColorSchemeName } from 'react-native';
import { lightColors, darkColors, type Colors } from './colors';
import { useSettings } from '../contexts/SettingsContext';

function resolveScheme(
  preference: 'system' | 'light' | 'dark',
  // RN 0.83+ can also report 'unspecified'; anything but 'dark' resolves to light.
  systemScheme: ColorSchemeName | null | undefined
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
