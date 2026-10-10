import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { monoFont, radius, space, useTheme } from '@/theme';

import { AmbientGlow, GradientFill } from './Gradient';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true, glow = true, style }: { children: ReactNode; scroll?: boolean; glow?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>
        {glow ? <AmbientGlow /> : null}
        {children}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {glow ? <AmbientGlow /> : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[{ padding: space.lg, paddingBottom: 56, gap: space.lg }, style]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'label' | 'mono';

export function T({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
  selectable,
}: {
  children: ReactNode;
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const c = useTheme();
  const base: Record<TextVariant, TextStyle> = {
    display: { fontSize: 34, fontWeight: '800', color: c.text, letterSpacing: -1 },
    title: { fontSize: 27, fontWeight: '800', color: c.text, letterSpacing: -0.7 },
    heading: { fontSize: 17, fontWeight: '700', color: c.text, letterSpacing: -0.2 },
    body: { fontSize: 15.5, color: c.text, lineHeight: 22 },
    caption: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
    label: { fontSize: 11, fontWeight: '700', color: c.textFaint, letterSpacing: 1.2, textTransform: 'uppercase' },
    mono: { fontSize: 12, fontFamily: monoFont, color: c.mono, lineHeight: 17 },
  };
  return (
    <Text style={[base[variant], color ? { color } : null, style]} numberOfLines={numberOfLines} selectable={selectable}>
      {children}
    </Text>
  );
}

/** Frosted glass surface. */
export function Card({ children, style, onPress, strong }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; strong?: boolean }) {
  const c = useTheme();
  const s: StyleProp<ViewStyle> = [
    {
      backgroundColor: strong ? c.surfaceStrong : c.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: c.border,
      padding: space.lg,
      shadowColor: c.dark ? '#000' : '#1B2559',
      shadowOpacity: c.dark ? 0.35 : 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    style,
  ];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s, pressed && { transform: [{ scale: 0.985 }], borderColor: c.borderStrong }]}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}

/** Gradient hero panel for summaries and key moments. */
export function HeroCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: radius.lg,
          overflow: 'hidden',
          padding: space.lg + 2,
          shadowColor: c.shadow,
          shadowOpacity: c.dark ? 0.45 : 0.3,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
        },
        style,
      ]}
    >
      <GradientFill />
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }]} pointerEvents="none" />
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const c = useTheme();
  const fg = { primary: '#FFFFFF', secondary: c.text, danger: c.danger, ghost: c.primary }[variant];
  const off = disabled || loading;
  const glow: ViewStyle =
    variant === 'primary' && !off
      ? { shadowColor: c.shadow, shadowOpacity: c.dark ? 0.6 : 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }
      : {};
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        {
          minHeight: 54,
          borderRadius: radius.pill,
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          backgroundColor:
            variant === 'secondary' ? c.surfaceAlt : variant === 'danger' ? c.dangerSoft : variant === 'primary' && off ? c.surfaceAlt : 'transparent',
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: c.border,
          opacity: off && variant !== 'primary' ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        glow,
        style,
      ]}
    >
      {variant === 'primary' && !off ? (
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius.pill, overflow: 'hidden' }]} pointerEvents="none">
          <GradientFill angle="horizontal" />
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? c.text : fg} />
      ) : icon ? (
        <Ionicons name={icon} size={19} color={variant === 'primary' && off ? c.textFaint : fg} />
      ) : null}
      <Text style={{ color: variant === 'primary' && off ? c.textFaint : fg, fontSize: 16, fontWeight: '700', letterSpacing: -0.1 }}>{title}</Text>
    </Pressable>
  );
}

/** Circular glass icon button for headers. */
export function IconButton({ icon, onPress, label, color }: { icon: IconName; onPress: () => void; label: string; color?: string }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceAlt,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: c.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={19} color={color ?? c.text} />
    </Pressable>
  );
}

/** Rounded square with a gradient (filled) or tinted background holding an icon. */
export function IconChip({ icon, size = 40, filled = true, tone }: { icon: IconName; size?: number; filled?: boolean; tone?: 'success' | 'warning' | 'danger' }) {
  const c = useTheme();
  const toneColor = tone ? { success: c.success, warning: c.warning, danger: c.danger }[tone] : undefined;
  const toneBg = tone ? { success: c.successSoft, warning: c.warningSoft, danger: c.dangerSoft }[tone] : undefined;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: toneBg ?? (filled ? undefined : c.primarySoft),
      }}
    >
      {filled && !tone ? <GradientFill /> : null}
      <Ionicons name={icon} size={size * 0.5} color={toneColor ?? (filled ? '#FFFFFF' : c.primary)} />
    </View>
  );
}

export function Badge({ text, tone = 'neutral', icon }: { text: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary'; icon?: IconName }) {
  const c = useTheme();
  const map = {
    neutral: [c.surfaceAlt, c.textMuted],
    success: [c.successSoft, c.success],
    warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger],
    primary: [c.primarySoft, c.primary],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' }}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

/** Glowing status dot + label: the app's signature "sealed" indicator. */
export function SealPill({ ok = true, text }: { ok?: boolean; text: string }) {
  const c = useTheme();
  const col = ok ? c.success : c.danger;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: ok ? c.successSoft : c.dangerSoft }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col, shadowColor: col, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }} />
      <Text style={{ color: col, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 }}>{text}</Text>
    </View>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const c = useTheme();
  return (
    <View style={{ gap: 7 }}>
      {label ? <T variant="label">{label}</T> : null}
      <TextInput
        placeholderTextColor={c.textFaint}
        accessibilityLabel={label}
        selectionColor={c.primary}
        {...props}
        style={[
          {
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: error ? c.danger : c.border,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            paddingVertical: 14,
            fontSize: 16,
            color: c.text,
          },
          props.style,
        ]}
      />
      {error ? <T variant="caption" color={c.danger}>{error}</T> : hint ? <T variant="caption">{hint}</T> : null}
    </View>
  );
}

export function Banner({ tone = 'primary', icon, title, body, children }: { tone?: 'primary' | 'success' | 'warning' | 'danger'; icon?: IconName; title: string; body?: string; children?: ReactNode }) {
  const c = useTheme();
  const map = { primary: [c.primarySoft, c.primary], success: [c.successSoft, c.success], warning: [c.warningSoft, c.warning], danger: [c.dangerSoft, c.danger] } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.md, padding: space.md + 2, flexDirection: 'row', gap: space.md, borderWidth: 1, borderColor: c.border }} accessibilityRole="summary">
      {icon ? <Ionicons name={icon} size={20} color={fg} style={{ marginTop: 1 }} /> : null}
      <View style={{ flex: 1, gap: 3 }}>
        <T variant="heading" style={{ fontSize: 15 }} color={fg}>{title}</T>
        {body ? <T variant="caption" color={c.text} style={{ opacity: 0.85 }}>{body}</T> : null}
        {children}
      </View>
    </View>
  );
}

export function Row({ icon, title, subtitle, right, onPress, destructive }: { icon?: IconName; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; destructive?: boolean }) {
  const c = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, minHeight: 52 }}>
      {icon ? (destructive ? <IconChip icon={icon} size={34} tone="danger" /> : <IconChip icon={icon} size={34} filled={false} />) : null}
      <View style={{ flex: 1, gap: 1 }}>
        <T style={{ fontWeight: '600' }} color={destructive ? c.danger : undefined}>{title}</T>
        {subtitle ? <T variant="caption">{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={c.textFaint} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
}

export function Divider() {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: c.border }} />;
}

export function HashText({ label, hash, note }: { label: string; hash: string; note?: string }) {
  const c = useTheme();
  return (
    <Pressable
      onLongPress={async () => {
        await Clipboard.setStringAsync(hash);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }}
      accessibilityLabel={`${label}. Long press to copy.`}
      style={{ gap: 6 }}
    >
      <T variant="label">{label}</T>
      <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.sm, padding: space.md, borderWidth: 1, borderColor: c.border }}>
        <T variant="mono" selectable>{hash}</T>
      </View>
      {note ? <T variant="caption">{note}</T> : null}
    </Pressable>
  );
}

export function Segmented<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: c.border }} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center', overflow: 'hidden' }}
          >
            {active ? <GradientFill angle="horizontal" /> : null}
            <Text style={{ fontSize: 13, fontWeight: active ? '800' : '600', color: active ? '#FFFFFF' : c.textMuted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.md, gap: space.md }}>
      <View style={{ shadowColor: c.shadow, shadowOpacity: 0.55, shadowRadius: 28, shadowOffset: { width: 0, height: 10 } }}>
        <IconChip icon={icon} size={84} />
      </View>
      <T variant="title" style={{ textAlign: 'center', marginTop: space.sm }}>{title}</T>
      <T variant="caption" style={{ textAlign: 'center', fontSize: 15, lineHeight: 22 }}>{body}</T>
      {children}
    </View>
  );
}

export function Loading() {
  const c = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, padding: space.xl }}>
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

/** Small stat used in hero cards. */
export function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
