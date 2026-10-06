import { useColorScheme } from 'react-native';

/** "Midnight Glass": dark-first, frosted surfaces, electric blue → violet accent. */
export type Palette = {
  dark: boolean;
  bg: string;
  bgGlowA: string;
  bgGlowB: string;
  surface: string;
  surfaceAlt: string;
  surfaceStrong: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  gradient: [string, string];
  accent: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  mono: string;
  shadow: string;
  paper: string;
};

export const dark: Palette = {
  dark: true,
  bg: '#070B14',
  bgGlowA: '#3B5BFF',
  bgGlowB: '#8B5CF6',
  surface: 'rgba(255,255,255,0.045)',
  surfaceAlt: 'rgba(255,255,255,0.08)',
  surfaceStrong: '#111A2E',
  border: 'rgba(160,175,255,0.14)',
  borderStrong: 'rgba(160,175,255,0.28)',
  text: '#F2F5FF',
  textMuted: '#A3ADCB',
  textFaint: '#66718F',
  primary: '#7C93FF',
  primaryText: '#FFFFFF',
  primarySoft: 'rgba(124,147,255,0.16)',
  gradient: ['#4F7CFF', '#9B5CF6'],
  accent: '#C4B5FD',
  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.14)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251,191,36,0.14)',
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.14)',
  mono: '#BCC7FF',
  shadow: '#4F7CFF',
  paper: '#F4F2EC',
};

export const light: Palette = {
  dark: false,
  bg: '#F3F5FB',
  bgGlowA: '#8FA8FF',
  bgGlowB: '#C4B5FD',
  surface: 'rgba(255,255,255,0.86)',
  surfaceAlt: 'rgba(79,93,245,0.07)',
  surfaceStrong: '#FFFFFF',
  border: 'rgba(23,32,72,0.08)',
  borderStrong: 'rgba(23,32,72,0.16)',
  text: '#0B1020',
  textMuted: '#4B5573',
  textFaint: '#8A93AD',
  primary: '#4F5DF5',
  primaryText: '#FFFFFF',
  primarySoft: 'rgba(79,93,245,0.10)',
  gradient: ['#4F7CFF', '#8B5CF6'],
  accent: '#7C3AED',
  success: '#059669',
  successSoft: 'rgba(5,150,105,0.10)',
  warning: '#B45309',
  warningSoft: 'rgba(217,119,6,0.12)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220,38,38,0.10)',
  mono: '#3D4A8F',
  shadow: '#4F5DF5',
  paper: '#FFFFFF',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 22, pill: 999 };
export const monoFont = 'Menlo';

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
