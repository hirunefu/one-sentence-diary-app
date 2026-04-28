export type Colors = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  textPlaceholder: string;
  border: string;
  divider: string;
  inputBorder: string;
  primary: string;
  primaryText: string;
  success: string;
  warning: string;
  danger: string;
  disabled: string;
  streakBg: string;
  streakText: string;
  error: string;
  loadingMessage: string;
};

export const lightColors: Colors = {
  background: '#ffffff',
  surface: '#fafafa',
  text: '#111111',
  textMuted: '#888888',
  textPlaceholder: '#bbbbbb',
  border: '#e8e8e8',
  divider: '#f0f0f0',
  inputBorder: '#e8e8e8',
  primary: '#111111',
  primaryText: '#ffffff',
  success: '#2e7d32',
  warning: '#ef6c00',
  danger: '#c62828',
  disabled: '#dddddd',
  streakBg: 'transparent',
  streakText: '#111111',
  error: '#c00000',
  loadingMessage: '#888888',
};

export const darkColors: Colors = {
  background: '#0d0d0d',
  surface: '#1a1a1a',
  text: '#ececec',
  textMuted: '#888888',
  textPlaceholder: '#666666',
  border: '#2a2a2a',
  divider: '#1f1f1f',
  inputBorder: '#2a2a2a',
  primary: '#ececec',
  primaryText: '#0d0d0d',
  success: '#66bb6a',
  warning: '#ffb74d',
  danger: '#ef5350',
  disabled: '#3a3a3a',
  streakBg: 'transparent',
  streakText: '#ececec',
  error: '#ef9a9a',
  loadingMessage: '#888888',
};
