import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { FlatList, View, useWindowDimensions } from 'react-native';

import { BusyModal } from '@/components/BusyModal';
import { Dock } from '@/components/Dock';
import { AmbientGlow } from '@/components/Gradient';
import { Badge, Banner, Button, Card, EmptyState, HeroCard, IconButton, IconChip, SealPill, Stat, T } from '@/components/ui';
import { useCapture } from '@/hooks/useCapture';
import { useQuery } from '@/hooks/useQuery';
import { showActionSheet } from '@/lib/actionSheet';
import { canCreateCase, FREE_LIMITS } from '@/lib/core/limits';
import { getDb } from '@/lib/db';
import { countActive, listCases } from '@/lib/db/queries';
import type { CaseSummary } from '@/lib/db/types';
import { formatDate, relativeTime } from '@/lib/format';
import { passGate } from '@/lib/gates';
import { lockStore } from '@/lib/state/lock';
import { prefsStore, setPref, type Prefs } from '@/lib/state/prefs';
import { useIsPro } from '@/lib/state/pro';
import { space, useTheme } from '@/theme';

function sortCases(cases: CaseSummary[], sort: Prefs['casesSort']) {
  const list = [...cases];
  if (sort === 'name') list.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === 'created') list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  else list.sort((a, b) => (b.last_activity ?? b.updated_at).localeCompare(a.last_activity ?? a.updated_at));
  return list;
}

export default function CasesScreen() {
  const c = useTheme();
  const isPro = useIsPro();
  const { width } = useWindowDimensions();
  const deviceUnsecured = lockStore.use((s) => s.deviceUnsecured);
  const { casesView, casesSort } = prefsStore.use((s) => s);
  const capture = useCapture();
  const { data } = useQuery(async () => {
    const db = await getDb();
    const [cases, counts] = await Promise.all([listCases(db), countActive(db)]);
    return { cases, counts };
  }, []);

  const newCase = () => {
    if (passGate(canCreateCase(isPro, data?.counts.cases ?? 0))) router.push('/case/new');
  };
  const cases = sortCases(data?.cases ?? [], casesSort);
  const totalPages = cases.reduce((n, k) => n + k.page_count, 0);
  const grid = casesView === 'grid';
  const tileW = (width - space.lg * 2 - space.md) / 2;

  const more = () =>
    showActionSheet('Cases', [
      { label: 'New Case', onPress: newCase },
      { label: 'Import Files', onPress: () => void capture.start('files') },
      { label: grid ? 'View as List' : 'View as Grid', onPress: () => void setPref('casesView', grid ? 'list' : 'grid') },
      {
        label: `Sort: ${{ modified: 'Last activity', created: 'Date created', name: 'Name' }[casesSort]}…`,
        onPress: () =>
          showActionSheet('Sort cases by', [
            { label: `${casesSort === 'modified' ? '✓ ' : ''}Last activity`, onPress: () => void setPref('casesSort', 'modified') },
            { label: `${casesSort === 'created' ? '✓ ' : ''}Date created`, onPress: () => void setPref('casesSort', 'created') },
            { label: `${casesSort === 'name' ? '✓ ' : ''}Name`, onPress: () => void setPref('casesSort', 'name') },
          ]),
      },
      { label: 'Recently Deleted', onPress: () => router.push('/trash') },
    ]);

  const renderItem = ({ item }: { item: CaseSummary }) =>
    grid ? (
      <Card onPress={() => router.push({ pathname: '/case/[id]', params: { id: item.id } })} style={{ width: tileW, padding: space.md, gap: space.sm }}>
        <IconChip icon="briefcase" size={40} />
        <T variant="heading" numberOfLines={2} style={{ fontSize: 15.5 }}>{item.title}</T>
        <T variant="caption" numberOfLines={1}>{item.exhibit_count} exhibits · {item.page_count} pp</T>
        <T variant="caption" style={{ fontSize: 11.5 }}>{relativeTime(item.last_activity ?? item.updated_at)}</T>
      </Card>
    ) : (
      <Card onPress={() => router.push({ pathname: '/case/[id]', params: { id: item.id } })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconChip icon="briefcase" size={46} />
          <View style={{ flex: 1, gap: 3 }}>
            <T variant="heading" numberOfLines={2}>{item.title}</T>
            {item.reference ? <T variant="mono" numberOfLines={1}>{item.reference}</T> : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge text={`${item.exhibit_count} exhibit${item.exhibit_count === 1 ? '' : 's'}`} tone="primary" icon="documents" />
          <Badge text={`${item.page_count} pages`} />
          {item.matter_date ? <Badge text={formatDate(item.matter_date)} icon="calendar-outline" /> : null}
        </View>
        <T variant="caption" style={{ marginTop: space.md }}>
          Active {relativeTime(item.last_activity ?? item.updated_at)}
        </T>
      </Card>
    );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AmbientGlow />
      <Stack.Screen
        options={{
          headerLeft: () => <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <IconButton icon="search" label="Search all exhibits" onPress={() => router.push('/search')} />
              <IconButton icon="ellipsis-horizontal" label="More options" onPress={more} />
            </View>
          ),
        }}
      />
      <FlatList
        key={grid ? 'grid' : 'list'}
        numColumns={grid ? 2 : 1}
        columnWrapperStyle={grid ? { gap: space.md } : undefined}
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 140 }}
        data={cases}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            {cases.length ? (
              <HeroCard>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.lg }}>
                  <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                  <T style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 }}>Sealed on this iPhone</T>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Stat value={data?.counts.cases ?? 0} label={data?.counts.cases === 1 ? 'Case' : 'Cases'} />
                  <Stat value={data?.counts.exhibits ?? 0} label="Exhibits" />
                  <Stat value={totalPages} label="Pages hashed" />
                </View>
              </HeroCard>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm }}>
              <SealPill text="On-device · no account · nothing uploaded" />
              {!isPro && data ? (
                <T variant="caption">
                  Free {data.counts.cases}/{FREE_LIMITS.cases} · {data.counts.exhibits}/{FREE_LIMITS.exhibits}
                </T>
              ) : null}
            </View>
            {deviceUnsecured ? (
              <Banner tone="warning" icon="warning" title="This iPhone has no passcode" body="App lock can't protect your files until you set a passcode in iOS Settings." />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          data ? (
            <EmptyState
              icon="scan"
              title="Start your first case"
              body="A case holds every document for one matter. Each scan becomes a numbered exhibit with a SHA-256 fingerprint and a tamper-evident custody log."
            >
              <Button title="Create a Case" icon="add" onPress={newCase} style={{ alignSelf: 'stretch', marginTop: space.md }} />
              <Button title="How evidence is protected" variant="ghost" onPress={() => router.push('/integrity')} />
            </EmptyState>
          ) : null
        }
        renderItem={renderItem}
      />
      <Dock onTools={() => router.push('/tools')} onScan={() => void capture.start('scan')} onPhotos={() => void capture.start('photos')} />
      <BusyModal label={capture.busy} />
    </View>
  );
}
