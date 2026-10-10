import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { BusyModal } from '@/components/BusyModal';
import { Banner, Button, Card, EmptyState, HashText, Screen, T } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { getDb } from '@/lib/db';
import { getCase, listExhibits } from '@/lib/db/queries';
import { mergeExhibits } from '@/lib/services/exports';
import { shareExport, type ExportedFile } from '@/lib/services/share';
import { space, useTheme } from '@/theme';

export default function MergeScreen() {
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const c = useTheme();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ExportedFile | null>(null);
  const { data } = useQuery(async () => {
    const db = await getDb();
    const [kase, exhibits] = await Promise.all([getCase(db, caseId), listExhibits(db, caseId)]);
    return { kase, exhibits: exhibits.filter((e) => e.current_version_id) };
  }, [caseId]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const merge = async () => {
    setBusy('Merging exhibits…');
    try {
      const file = await mergeExhibits(caseId, [...selected]);
      setResult(file);
      await shareExport(file);
    } catch (e) {
      Alert.alert('Could not merge', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (data && !data.exhibits.length) return <EmptyState icon="git-merge" title="Nothing to merge yet" body="This case needs at least two sealed exhibits." />;

  return (
    <Screen>
      <T variant="title">Merge into one PDF</T>
      <T variant="caption">{data?.kase?.title} · pages keep their text layer. Exhibits are combined in number order.</T>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button
          title={selected.size === data?.exhibits.length ? 'Select None' : 'Select All'}
          variant="ghost"
          onPress={() => setSelected(selected.size === data?.exhibits.length ? new Set() : new Set(data?.exhibits.map((e) => e.id)))}
          style={{ minHeight: 36, paddingHorizontal: 0 }}
        />
      </View>
      {data?.exhibits.map((e) => {
        const on = selected.has(e.id);
        return (
          <Pressable key={e.id} onPress={() => toggle(e.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
            <Card style={{ padding: space.md, borderColor: on ? c.primary : c.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? c.primary : c.textFaint} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '700' }} numberOfLines={1}>Ex. {e.number} · {e.title}</T>
                  <T variant="caption">{e.page_count} page{e.page_count === 1 ? '' : 's'}{(e.current_version ?? 1) > 1 ? ` · v${e.current_version}` : ''}</T>
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
      <Button title={`Merge ${selected.size || ''} Exhibits`.replace('  ', ' ')} icon="git-merge" onPress={() => void merge()} disabled={selected.size < 2} />
      {result ? (
        <>
          <Banner tone="success" icon="checkmark-circle" title="Merged PDF ready" body="Each included exhibit's custody log records this export." />
          <HashText label="Merged PDF SHA-256" hash={result.sha256} />
          <Button title="Share Again" icon="share-outline" variant="secondary" onPress={() => void shareExport(result)} />
        </>
      ) : null}
      <BusyModal label={busy} note="Verifying each exhibit's hash first" />
    </Screen>
  );
}
