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

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ padding: space.lg, paddingBottom: 48, gap: space.lg }, style]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

type TextVariant = 'title' | 'heading' | 'body' | 'caption' | 'label' | 'mono';

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
    title: { fontSize: 26, fontWeight: '700', color: c.text, letterSpacing: -0.4 },
    heading: { fontSize: 17, fontWeight: '600', color: c.text },
    body: { fontSize: 15, color: c.text, lineHeight: 21 },
    caption: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
    label: { fontSize: 11, fontWeight: '700', color: c.textFaint, letterSpacing: 0.8, textTransform: 'uppercase' },
    mono: { fontSize: 12, fontFamily: monoFont, color: c.mono, lineHeight: 17 },
  };
  return (
    <Text style={[base[variant], color ? { color } : null, style]} numberOfLines={numberOfLines} selectable={selectable}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const c = useTheme();
  const s = [{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, padding: space.lg }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.75 }]} accessibilityRole="button">
      {children}
    </Pressable>
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
  const bg = { primary: c.primary, secondary: c.primarySoft, danger: c.dangerSoft, ghost: 'transparent' }[variant];
  const fg = { primary: c.primaryText, secondary: c.primary, danger: c.danger, ghost: c.primary }[variant];
  const off = disabled || loading;
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
          backgroundColor: bg,
          minHeight: 50,
          borderRadius: radius.md,
          paddingHorizontal: space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: off ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={19} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color }: { icon: IconName; onPress: () => void; label: string; color?: string }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.5 : 1 })}>
      <Ionicons name={icon} size={24} color={color ?? c.primary} />
    </Pressable>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const c = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{label}</T>
      <TextInput
        placeholderTextColor={c.textFaint}
        accessibilityLabel={label}
        {...props}
        style={[
          {
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: error ? c.danger : c.border,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: 12,
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
    <View style={{ backgroundColor: bg, borderRadius: radius.md, padding: space.md, flexDirection: 'row', gap: space.md }} accessibilityRole="summary">
      {icon ? <Ionicons name={icon} size={20} color={fg} style={{ marginTop: 1 }} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="heading" style={{ fontSize: 15 }} color={fg}>{title}</T>
        {body ? <T variant="caption" color={c.text}>{body}</T> : null}
        {children}
      </View>
    </View>
  );
}

export function Row({ icon, title, subtitle, right, onPress, destructive }: { icon?: IconName; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; destructive?: boolean }) {
  const c = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, minHeight: 48 }}>
      {icon ? <Ionicons name={icon} size={20} color={destructive ? c.danger : c.primary} /> : null}
      <View style={{ flex: 1 }}>
        <T color={destructive ? c.danger : undefined}>{title}</T>
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
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
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
      style={{ gap: 4 }}
    >
      <T variant="label">{label}</T>
      <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.sm, padding: space.sm }}>
        <T variant="mono" selectable>{hash}</T>
      </View>
      {note ? <T variant="caption">{note}</T> : null}
    </Pressable>
  );
}

export function Segmented<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: 3 }} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: active ? c.surface : 'transparent', alignItems: 'center' }}
          >
            <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? c.text : c.textMuted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.lg, gap: space.md }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={34} color={c.primary} />
      </View>
      <T variant="heading" style={{ textAlign: 'center', fontSize: 19 }}>{title}</T>
      <T variant="caption" style={{ textAlign: 'center', fontSize: 15, lineHeight: 21 }}>{body}</T>
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
