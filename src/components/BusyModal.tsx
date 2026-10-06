import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { T } from './ui';

export function BusyModal({ label, note = 'Computing SHA-256 on device' }: { label: string | null; note?: string }) {
  const c = useTheme();
  return (
    <Modal visible={!!label} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(3,6,14,0.62)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ backgroundColor: c.surfaceStrong, borderRadius: radius.lg, padding: space.xl, alignItems: 'center', gap: space.md, minWidth: 240, borderWidth: 1, borderColor: c.border }}>
          <ActivityIndicator color={c.primary} />
          <T variant="heading">{label}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="finger-print" size={14} color={c.textMuted} />
            <T variant="caption">{note}</T>
          </View>
        </View>
      </View>
    </Modal>
  );
}
