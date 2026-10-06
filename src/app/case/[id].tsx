import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, View } from 'react-native';

import { GradientFill, AmbientGlow } from '@/components/Gradient';
import { Badge, Button, Card, EmptyState, HeroCard, IconButton, Loading, SealPill, Stat, T } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { confirm, showActionSheet } from '@/lib/actionSheet';
import { canAddExhibit, canUse } from '@/lib/core/limits';
import { shortHash } from '@/lib/core/text';
import { getDb } from '@/lib/db';
import { countActive, getCase, listExhibits } from '@/lib/db/queries';
import type { ExhibitListItem } from '@/lib/db/types';
import { formatDate, formatDateTime } from '@/lib/format';
import { passGate } from '@/lib/gates';
import { toAbsolute } from '@/lib/platform/files';
import { scanPages } from '@/lib/platform/scanner';
import { captureExhibit } from '@/lib/services/capture';
import { deleteCase } from '@/lib/services/cases';
import { useIsPro } from '@/lib/state/pro';
import { radius, space, useTheme } from '@/theme';

function OcrBadge({ item }: { item: ExhibitListItem }) {
  if (item.ocr_status === 'done' && item.current_version_id) return <SealPill text="Sealed · searchable" />;
  if (item.ocr_status === 'failed') return <Badge text="Sealed · no text" tone="warning" icon="alert-circle-outline" />;
  return <Badge text="Sealing…" tone="primary" icon="hourglass-outline" />;
}

export default function CaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const isPro = useIsPro();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, loading } = useQuery(async () => {
    const db = await getDb();
    const [kase, exhibits, counts] = await Promise.all([getCase(db, id), listExhibits(db, id), countActive(db)]);
    return { kase, exhibits, counts };
  }, [id]);

  if (loading && !data) return <Loading />;
  const kase = data?.kase;
  if (!kase) {
    return <EmptyState icon="alert-circle-outline" title="Case not found" body="It may have been deleted." />;
  }

  const scan = async () => {
    if (!passGate(canAddExhibit(isPro, data.counts.exhibits))) return;
    let uris: string[] | null = null;
    try {
      uris = await scanPages();
    } catch (e) {
      Alert.alert('Scanner unavailable', `${(e as Error).message}\n\nCheck that ScaniPro has camera access in iOS Settings.`);
      return;
    }
    if (!uris) return;
    setBusy(`Sealing ${uris.length} page${uris.length > 1 ? 's' : ''}…`);
    try {
      const exhibitId = await captureExhibit(kase.id, uris);
      router.push({ pathname: '/exhibit/[id]', params: { id: exhibitId } });
    } catch (e) {
      Alert.alert('Capture failed', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const exportPacket = () => {
    if (!data.exhibits.length) {
      Alert.alert('Nothing to export yet', 'Scan at least one exhibit first.');
      return;
    }
    if (passGate(canUse(isPro, 'packet_export'))) router.push({ pathname: '/export/[caseId]', params: { caseId: kase.id } });
  };

  const menu = () =>
    showActionSheet(kase.title, [
      { label: 'Export Evidence Packet', onPress: exportPacket },
      { label: 'Edit Case Details', onPress: () => router.push({ pathname: '/case/new', params: { caseId: kase.id } }) },
      {
        label: 'Delete Case…',
        destructive: true,
        onPress: () =>
          confirm(
            'Delete this case?',
            `This permanently deletes "${kase.title}", all ${data.exhibits.length} exhibits, their files and custody logs from this iPhone. Export a packet first if you need a record. This cannot be undone.`,
            'Delete Case',
            async () => {
              await deleteCase(kase.id);
              router.back();
            },
          ),
      },
    ]);

  const pageTotal = data.exhibits.reduce((n, e) => n + e.page_count, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AmbientGlow />
      <Stack.Screen
        options={{
          title: kase.reference || 'Case',
          headerRight: () => <IconButton icon="ellipsis-horizontal-circle" label="Case actions" onPress={menu} />,
        }}
      />
      <FlatList
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 130 }}
        data={data.exhibits}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            <T variant="display">{kase.title}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {kase.reference ? <Badge text={kase.reference} icon="pricetag-outline" /> : null}
              {kase.matter_date ? <Badge text={formatDate(kase.matter_date)} icon="calendar-outline" /> : null}
            </View>
            {kase.notes ? <T variant="caption">{kase.notes}</T> : null}
            {data.exhibits.length ? (
              <HeroCard>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Stat value={data.exhibits.length} label="Exhibits" />
                  <Stat value={pageTotal} label="Pages" />
                  <Stat value={data.exhibits.filter((e) => e.current_version_id).length} label="Sealed PDFs" />
                </View>
              </HeroCard>
            ) : null}
            <Button title="Export Evidence Packet" icon="briefcase" variant="secondary" onPress={exportPacket} />
            {data.exhibits.length ? <T variant="label" style={{ marginTop: space.sm }}>Exhibits</T> : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="scan-outline"
            title="Scan your first exhibit"
            body="ScaniPro hashes every page the moment it's captured and starts a custody log. Exhibits are numbered automatically."
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => router.push({ pathname: '/exhibit/[id]', params: { id: item.id } })} style={{ padding: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ width: 70, height: 92, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: c.paper, borderWidth: 1, borderColor: c.border }}>
                {item.first_page_path ? (
                  <Image source={{ uri: toAbsolute(item.first_page_path).uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
                ) : null}
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <View style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' }}>
                    <GradientFill angle="horizontal" />
                    <T style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11.5, letterSpacing: 0.6 }}>EX {item.number}</T>
                  </View>
                  {item.current_version && item.current_version > 1 ? <Badge text={`v${item.current_version}`} tone="warning" icon="create-outline" /> : null}
                </View>
                <T variant="heading" numberOfLines={2}>{item.title}</T>
                <T variant="caption">{item.page_count} page{item.page_count > 1 ? 's' : ''} · {formatDateTime(item.captured_at)}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                  <OcrBadge item={item} />
                  <T variant="mono" style={{ fontSize: 11 }}>{shortHash(item.current_sha256 ?? item.capture_digest, 6)}</T>
                </View>
              </View>
            </View>
          </Card>
        )}
      />
      <View style={{ position: 'absolute', left: space.xl, right: space.xl, bottom: 34 }}>
        <Button title="Scan Exhibit" icon="scan" onPress={scan} accessibilityHint="Opens the document camera" />
      </View>
      <Modal visible={!!busy} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(3,6,14,0.62)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: c.surfaceStrong, borderRadius: radius.lg, padding: space.xl, alignItems: 'center', gap: space.md, minWidth: 240, borderWidth: 1, borderColor: c.border }}>
            <ActivityIndicator color={c.primary} />
            <T variant="heading">{busy}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="finger-print" size={14} color={c.textMuted} />
              <T variant="caption">Computing SHA-256 on device</T>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
