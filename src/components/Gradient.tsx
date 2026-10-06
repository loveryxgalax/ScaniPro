import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

/** Fills its parent with a linear gradient (react-native-svg, no extra native module). */
export function GradientFill({
  colors,
  angle = 'diagonal',
  opacity = 1,
  style,
}: {
  colors?: [string, string];
  angle?: 'diagonal' | 'horizontal' | 'vertical';
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const id = useId().replace(/:/g, '');
  const [a, b] = colors ?? c.gradient;
  const end = angle === 'horizontal' ? { x2: '1', y2: '0' } : angle === 'vertical' ? { x2: '0', y2: '1' } : { x2: '1', y2: '1' };
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" {...end}>
            <Stop offset="0" stopColor={a} stopOpacity={opacity} />
            <Stop offset="1" stopColor={b} stopOpacity={opacity} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Soft coloured light behind the top of a screen. */
export function AmbientGlow({ height = 420 }: { height?: number }) {
  const c = useTheme();
  const id = useId().replace(/:/g, '');
  const strength = c.dark ? 0.32 : 0.28;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height }} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={`${id}a`} cx="15%" cy="0%" rx="75%" ry="70%">
            <Stop offset="0" stopColor={c.bgGlowA} stopOpacity={strength} />
            <Stop offset="1" stopColor={c.bgGlowA} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}b`} cx="95%" cy="10%" rx="65%" ry="60%">
            <Stop offset="0" stopColor={c.bgGlowB} stopOpacity={strength * 0.8} />
            <Stop offset="1" stopColor={c.bgGlowB} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id}a)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}b)`} />
      </Svg>
    </View>
  );
}
