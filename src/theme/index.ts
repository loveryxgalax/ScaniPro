import { useColorScheme } from 'react-native';

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  accent: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  mono: string;
};

export const light: Palette = {
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F6',
  border: '#DDE2EA',
  text: '#0E1726',
  textMuted: '#4A5568',
  textFaint: '#8792A2',
  primary: '#1C3F78',
  primaryText: '#FFFFFF',
  primarySoft: '#E3EBF7',
  accent: '#B08D3C',
  success: '#1F7A4D',
  successSoft: '#E1F3EA',
  warning: '#9A6A00',
  warningSoft: '#FBF1D9',
  danger: '#B42318',
  dangerSoft: '#FDE8E6',
  mono: '#2B3A55',
};

export const dark: Palette = {
  bg: '#0B1220',
  surface: '#131C2E',
  surfaceAlt: '#1A2539',
  border: '#26324A',
  text: '#E8EDF5',
  textMuted: '#A6B0C2',
  textFaint: '#6B778C',
  primary: '#7FA6E8',
  primaryText: '#0B1220',
  primarySoft: '#1B2B47',
  accent: '#D4B46A',
  success: '#5CC795',
  successSoft: '#143224',
  warning: '#E5B04A',
  warningSoft: '#33290F',
  danger: '#F2867B',
  dangerSoft: '#3A1A18',
  mono: '#C6D3EA',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const monoFont = 'Menlo';

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
