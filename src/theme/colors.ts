export type Colors = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  textPlaceholder: string;
  border: string;
  divider: string;
  primary: string;
  primaryText: string;
  success: string;
  warning: string;
  danger: string;
  // Calendar weekday tints for Sunday / Saturday day numbers.
  sunday: string;
  saturday: string;
  disabled: string;
  error: string;
  loadingMessage: string;
};

// Text tokens keep at least 4.5:1 contrast (WCAG AA) against both
// `background` and `surface`; the greys are the lightest values that do.
export const lightColors: Colors = {
  background: '#ffffff',
  surface: '#fafafa',
  text: '#111111',
  textMuted: '#737373',
  textPlaceholder: '#737373',
  border: '#e8e8e8',
  divider: '#f0f0f0',
  primary: '#111111',
  primaryText: '#ffffff',
  success: '#2e7d32',
  warning: '#b35300',
  danger: '#c62828',
  sunday: '#b83c3c',
  saturday: '#2f73b3',
  disabled: '#dddddd',
  error: '#c00000',
  loadingMessage: '#737373',
};

export const darkColors: Colors = {
  background: '#0d0d0d',
  surface: '#1a1a1a',
  text: '#ececec',
  textMuted: '#888888',
  textPlaceholder: '#828282',
  border: '#2a2a2a',
  divider: '#1f1f1f',
  primary: '#ececec',
  primaryText: '#0d0d0d',
  success: '#66bb6a',
  warning: '#ffb74d',
  danger: '#ef5350',
  sunday: '#e57373',
  saturday: '#5b9bd5',
  disabled: '#3a3a3a',
  error: '#ef9a9a',
  loadingMessage: '#888888',
};
