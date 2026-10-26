import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  card: string;

  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;

  // Primary colors
  primary: string;
  primaryDark: string;
  primaryLight: string;

  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // Border colors
  border: string;
  borderLight: string;

  // Shadow
  shadow: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
}

const lightColors: ThemeColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  card: '#ffffff',

  text: '#333333',
  textSecondary: '#666666',
  textMuted: '#999999',

  primary: '#007AFF',
  primaryDark: '#0056CC',
  primaryLight: '#E3F2FD',

  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  border: '#e1e1e1',
  borderLight: '#f0f0f0',

  shadow: 'rgba(0, 0, 0, 0.1)',
};

const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1e1e1e',
  card: '#2d2d2d',

  text: '#ffffff',
  textSecondary: '#b3b3b3',
  textMuted: '#808080',

  primary: '#0A84FF',
  primaryDark: '#0056CC',
  primaryLight: '#1a1a1a',

  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  border: '#333333',
  borderLight: '#404040',

  shadow: 'rgba(0, 0, 0, 0.3)',
};

export const themes = {
  light: {
    mode: 'light' as ThemeMode,
    colors: lightColors,
    isDark: false,
  },
  dark: {
    mode: 'dark' as ThemeMode,
    colors: darkColors,
    isDark: true,
  },
};

export const getSystemTheme = (): Theme => {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? themes.dark : themes.light;
};

export const getThemeForMode = (mode: ThemeMode): Theme => {
  switch (mode) {
    case 'light':
      return themes.light;
    case 'dark':
      return themes.dark;
    case 'auto':
    default:
      return getSystemTheme();
  }
};
