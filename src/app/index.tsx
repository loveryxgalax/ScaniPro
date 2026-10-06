import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { FlatList, View } from 'react-native';

import { Badge, Banner, Button, Card, EmptyState, IconButton, T } from '@/components/ui';
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

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: space.lg }}>
              <IconButton icon="search" label="Search all exhibits" onPress={() => router.push('/search')} />
              <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
            </View>
          ),
        }}
      />
      <FlatList
        style={{ flex: 1, backgroundColor: c.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 120 }}
        data={data?.cases ?? []}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="lock-closed" size={13} color={c.success} />
              <T variant="caption" color={c.success}>On-device only · no account · nothing uploaded</T>
            </View>
            {deviceUnsecured ? (
              <Banner tone="warning" icon="warning" title="This iPhone has no passcode" body="App lock can't protect your files until you set a passcode in iOS Settings." />
            ) : null}
            {!isPro && data ? (
              <T variant="caption">
                Free version: {data.counts.cases}/{FREE_LIMITS.cases} case · {data.counts.exhibits}/{FREE_LIMITS.exhibits} exhibits
              </T>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          data ? (
            <EmptyState
              icon="briefcase-outline"
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
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="briefcase" size={22} color={c.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="heading" numberOfLines={2}>{item.title}</T>
                {item.reference ? <T variant="mono" numberOfLines={1}>Ref. {item.reference}</T> : null}
                <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 4, flexWrap: 'wrap' }}>
                  <Badge text={`${item.exhibit_count} exhibit${item.exhibit_count === 1 ? '' : 's'}`} tone="primary" icon="documents-outline" />
                  <Badge text={`${item.page_count} pages`} />
                  {item.matter_date ? <Badge text={formatDate(item.matter_date)} icon="calendar-outline" /> : null}
                </View>
              </View>
            </View>
            <T variant="caption" style={{ marginTop: space.md }}>
              Last activity {relativeTime(item.last_activity ?? item.updated_at)}
            </T>
          </Card>
        )}
      />
      {data?.cases.length ? (
        <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: 34 }}>
          <Button title="New Case" icon="add" onPress={newCase} />
        </View>
      ) : null}
    </>
  );
}
