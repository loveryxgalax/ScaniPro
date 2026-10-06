import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Banner, Button, Card, EmptyState, IconChip, Screen, T } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/actionSheet';
import { getDb } from '@/lib/db';
import { listTrash } from '@/lib/db/queries';
import { formatDate } from '@/lib/format';
import { purgeExhibit, restoreExhibit, TRASH_DAYS } from '@/lib/services/exhibits';
import { space } from '@/theme';

export default function TrashScreen() {
  const [working, setWorking] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const { data } = useQuery(async () => listTrash(await getDb()), []);

  if (data && !data.length) {
    return <EmptyState icon="trash-outline" title="Nothing here" body={`Withdrawn exhibits stay here for ${TRASH_DAYS} days so you can restore them.`} />;
  }

  const daysLeft = (iso: string) => Math.max(0, TRASH_DAYS - Math.floor((now - new Date(iso).getTime()) / 86400000));

  return (
    <Screen>
      <Banner icon="information-circle-outline" title={`Kept for ${TRASH_DAYS} days`} body="Restoring adds a 'Restored' entry to the custody log. After the time runs out, or if you delete now, the files are erased; the custody log and its hashes are kept." />
      {data?.map((e) => (
        <Card key={e.id} style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconChip icon="document" size={40} filled={false} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700' }} numberOfLines={1}>Ex. {e.number} · {e.title}</T>
              <T variant="caption" numberOfLines={1}>{e.case_title} · deleted {formatDate(e.deleted_at as string)} · {daysLeft(e.deleted_at as string)} days left</T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              title="Restore"
              icon="arrow-undo"
              variant="secondary"
              style={{ flex: 1 }}
              loading={working === e.id}
              onPress={async () => {
                setWorking(e.id);
                try {
                  await restoreExhibit(e.id);
                } catch (err) {
                  Alert.alert('Could not restore', (err as Error).message);
                } finally {
                  setWorking(null);
                }
              }}
            />
            <Button
              title="Delete Now"
              icon="trash"
              variant="danger"
              style={{ flex: 1 }}
              onPress={() => confirm('Delete permanently?', 'The files are erased from this iPhone. The custody log and its hashes are kept so packets show the gap.', 'Delete', () => void purgeExhibit(e.id))}
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
