import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, SectionList, View } from 'react-native';

import { AmbientGlow } from '@/components/Gradient';
import { BusyModal } from '@/components/BusyModal';
import { Card, EmptyState, IconChip, T } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { getDb } from '@/lib/db';
import { listAllActiveExhibits } from '@/lib/db/queries';
import { exportExhibit, type ExportFormat } from '@/lib/services/exports';
import { space, useTheme } from '@/theme';

type Action = ExportFormat | 'sign';
const TITLES: Record<Action, string> = { text: 'Export to Text', images: 'Export to Images', docx: 'Export to Word', pptx: 'Export to PowerPoint', sign: 'Sign an Exhibit' };

export default function PickExhibitScreen() {
  const { action = 'text' } = useLocalSearchParams<{ action?: Action }>();
  const c = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const { data } = useQuery(async () => listAllActiveExhibits(await getDb()), []);

  const sections = Object.values(
    (data ?? []).reduce<Record<string, { title: string; data: NonNullable<typeof data> }>>((acc, ex) => {
      (acc[ex.case_id] ??= { title: ex.case_title, data: [] }).data.push(ex);
      return acc;
    }, {}),
  );

  const pick = async (id: string, versionId: string | null, kind: string) => {
    if (kind === 'pdf') {
      Alert.alert('Not available for imported PDFs', 'Imported PDFs are kept exactly as received. Use Share PDF from the exhibit instead.');
      return;
    }
    if (!versionId) {
      Alert.alert('Still processing', 'This exhibit is still being sealed. Try again in a moment.');
      return;
    }
    if (action === 'sign') {
      router.replace({ pathname: '/exhibit/annotate', params: { id, versionId } });
      return;
    }
    setBusy('Preparing export…');
    try {
      await exportExhibit(id, action);
    } catch (e) {
      Alert.alert('Could not export', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AmbientGlow />
      <Stack.Screen options={{ title: TITLES[action] }} />
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: 60 }}
        sections={sections}
        keyExtractor={(e) => e.id}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={<T variant="caption" style={{ marginBottom: space.sm }}>Choose an exhibit. The export is verified against its hash first and recorded in its custody log.</T>}
        ListEmptyComponent={data ? <EmptyState icon="documents" title="No exhibits yet" body="Scan or import a document first." /> : null}
        renderSectionHeader={({ section }) => <T variant="label" style={{ marginTop: space.md, marginBottom: space.xs }}>{section.title}</T>}
        renderItem={({ item }) => (
          <Card onPress={() => void pick(item.id, item.current_version_id, item.kind)} style={{ padding: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <IconChip icon={item.kind === 'pdf' ? 'document-text' : 'document'} size={36} filled={item.kind !== 'pdf'} />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700' }} numberOfLines={1}>Ex. {item.number} · {item.title}</T>
                <T variant="caption">{item.page_count} page{item.page_count === 1 ? '' : 's'}{item.kind === 'pdf' ? ' · imported PDF' : ''}</T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
            </View>
          </Card>
        )}
      />
      <BusyModal label={busy} note="Verifying hashes on device" />
    </View>
  );
}
