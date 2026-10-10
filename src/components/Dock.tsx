import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { GradientFill } from './Gradient';
import type { IconName } from './ui';

function Side({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ width: 64, height: 56, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
      <Ionicons name={icon} size={26} color={c.text} />
    </Pressable>
  );
}

/** Floating glass dock: Tools · Scan · Photos. */
export function Dock({ onTools, onScan, onPhotos }: { onTools: () => void; onScan: () => void; onPhotos: () => void }) {
  const c = useTheme();
  return (
    <View style={{ position: 'absolute', bottom: 30, alignSelf: 'center' }} pointerEvents="box-none">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 18,
          paddingHorizontal: 14,
          height: 76,
          borderRadius: 38,
          backgroundColor: c.dark ? 'rgba(20,28,48,0.92)' : 'rgba(255,255,255,0.94)',
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: c.borderStrong,
          shadowColor: '#000',
          shadowOpacity: c.dark ? 0.5 : 0.12,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
        }}
      >
        <Side icon="apps" label="Tools" onPress={onTools} />
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onScan();
          }}
          accessibilityRole="button"
          accessibilityLabel="Scan a document"
          style={({ pressed }) => ({
            width: 64,
            height: 64,
            borderRadius: 32,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.94 : 1 }],
            shadowColor: c.shadow,
            shadowOpacity: 0.7,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
          })}
        >
          <GradientFill />
          <Ionicons name="scan" size={30} color="#FFFFFF" />
        </Pressable>
        <Side icon="images" label="Import from Photos" onPress={onPhotos} />
      </View>
    </View>
  );
}
