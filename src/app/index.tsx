import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { FlatList, View } from 'react-native';

import { AmbientGlow } from '@/components/Gradient';
import { Badge, Banner, Button, Card, EmptyState, HeroCard, IconButton, IconChip, SealPill, Stat, T } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { canCreateCase, FREE_LIMITS } from '@/lib/core/limits';
import { getDb } from '@/lib/db';
import { countActive, listCases } from '@/lib/db/queries';
import { formatDate, relativeTime } from '@/lib/format';
import { passGate } from '@/lib/gates';
import { lockStore } from '@/lib/state/lock';
import { useIsPro } from '@/lib/state/pro';
import { space, useTheme } from '@/theme';

export default function CasesScreen() {
  const c = useTheme();
  const isPro = useIsPro();
  const deviceUnsecured = lockStore.use((s) => s.deviceUnsecured);
  const { data } = useQuery(async () => {
    const db = await getDb();
    const [cases, counts] = await Promise.all([listCases(db), countActive(db)]);
    return { cases, counts };
  }, []);

  const newCase = () => {
    if (passGate(canCreateCase(isPro, data?.counts.cases ?? 0))) router.push('/case/new');
  };
  const totalPages = data?.cases.reduce((n, k) => n + k.page_count, 0) ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AmbientGlow />
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <IconButton icon="search" label="Search all exhibits" onPress={() => router.push('/search')} />
              <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
            </View>
          ),
        }}
      />
      <FlatList
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 130 }}
        data={data?.cases ?? []}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            {data?.cases.length ? (
              <HeroCard>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.lg }}>
                  <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                  <T style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 }}>Sealed on this iPhone</T>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Stat value={data.counts.cases} label={data.counts.cases === 1 ? 'Case' : 'Cases'} />
                  <Stat value={data.counts.exhibits} label="Exhibits" />
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
        renderItem={({ item }) => (
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
        )}
      />
      {data?.cases.length ? (
        <View style={{ position: 'absolute', left: space.xl, right: space.xl, bottom: 34 }}>
          <Button title="New Case" icon="add" onPress={newCase} />
        </View>
      ) : null}
    </View>
  );
}
