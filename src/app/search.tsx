import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { AmbientGlow } from '@/components/Gradient';

import { Card, EmptyState, Field, T } from '@/components/ui';
import { toFtsQuery } from '@/lib/core/search';
import { getDb } from '@/lib/db';
import { searchAll } from '@/lib/db/queries';
import type { SearchHit } from '@/lib/db/types';
import { space, useTheme } from '@/theme';

function Snippet({ text }: { text: string }) {
  const c = useTheme();
  const parts = text.split(/(\[\[.*?\]\])/g);
  return (
    <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
      {parts.map((p, i) =>
        p.startsWith('[[') ? (
          <Text key={i} style={{ color: c.text, fontWeight: '800', backgroundColor: c.primarySoft }}>{p.slice(2, -2)}</Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  );
}

export default function SearchScreen() {
  const c = useTheme();
  const [q, setQ] = useState('');
  const [result, setResult] = useState<{ match: string; hits: SearchHit[] } | null>(null);
  const match = toFtsQuery(q);
  const hits = match && result?.match === match ? result.hits : null;

  useEffect(() => {
    if (!match) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      let rows: SearchHit[] = [];
      try {
        rows = await searchAll(await getDb(), match);
      } catch {
        // Treat malformed queries as no results.
      }
      if (!cancelled) setResult({ match, hits: rows });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [match]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    <AmbientGlow />
    <FlatList
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      data={hits ?? []}
      keyExtractor={(h) => `${h.exhibit_id}-${h.page_index}`}
      ListHeaderComponent={
        <View style={{ gap: space.sm }}>
          <Field label="Search all exhibits" placeholder="Names, dates, amounts, addresses…" value={q} onChangeText={setQ} autoFocus clearButtonMode="while-editing" autoCorrect={false} returnKeyType="search" />
          <T variant="caption">Searches exhibit titles and recognised text across every case. The index lives only on this iPhone.</T>
        </View>
      }
      ListEmptyComponent={
        !match ? (
          <EmptyState icon="search" title="Find any word in any exhibit" body="Text is recognised on-device the moment you scan, so even photographed paper becomes searchable." />
        ) : hits === null ? null : (
          <EmptyState icon="document-outline" title="No matches" body={`Nothing found for "${q.trim()}".`} />
        )
      }
      renderItem={({ item }) => (
        <Card onPress={() => router.push({ pathname: '/exhibit/[id]', params: { id: item.exhibit_id } })} style={{ gap: 4 }}>
          <T variant="label">{item.case_title} · Exhibit {item.exhibit_number} · page {item.page_index + 1}</T>
          <T variant="heading">{item.exhibit_title}</T>
          {item.snippet ? <Snippet text={item.snippet} /> : null}
        </Card>
      )}
    />
    </View>
  );
}
