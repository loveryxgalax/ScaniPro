import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { Banner, Button, Card, Divider, HashText, Row, Screen, T } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { canUse } from '@/lib/core/limits';
import { formatBytes } from '@/lib/core/text';
import { getDb } from '@/lib/db';
import { getCase, listExhibits } from '@/lib/db/queries';
import { passGate } from '@/lib/gates';
import { exportPacket, shareExport, type ExportedFile, type PacketExport } from '@/lib/services/packet';
import { useIsPro } from '@/lib/state/pro';
import { space, useTheme } from '@/theme';

function FileRow({ file, icon, title, subtitle }: { file: ExportedFile; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) {
  const c = useTheme();
  return (
    <Row
      icon={icon}
      title={title}
      subtitle={`${subtitle} · ${formatBytes(file.bytes)}`}
      onPress={() => void shareExport(file).catch((e: Error) => Alert.alert('Could not share', e.message))}
      right={<Ionicons name="share-outline" size={20} color={c.primary} />}
    />
  );
}

export default function ExportScreen() {
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const c = useTheme();
  const isPro = useIsPro();
  const [useLatest, setUseLatest] = useState(true);
  const [embed, setEmbed] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<PacketExport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery(async () => {
    const db = await getDb();
    const [kase, exhibits] = await Promise.all([getCase(db, caseId), listExhibits(db, caseId)]);
    return { kase, exhibits };
  }, [caseId]);

  const run = async () => {
    if (!passGate(canUse(isPro, 'packet_export'))) return;
    setError(null);
    setResult(null);
    setProgress('Preparing…');
    try {
      setResult(await exportPacket(caseId, { useLatestVersions: useLatest, embedExhibitFiles: embed }, setProgress));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const derivedCount = data?.exhibits.filter((e) => (e.current_version ?? 1) > 1).length ?? 0;

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <T variant="title">{data?.kase?.title ?? 'Evidence Packet'}</T>
        <T variant="caption">{data?.exhibits.length ?? 0} exhibits · built entirely on this iPhone</T>
      </View>

      <Card style={{ gap: space.sm }}>
        <T variant="label">The packet contains</T>
        {[
          ['document-text-outline', 'Cover page with case details and integrity statement'],
          ['list-outline', 'Exhibit index with page references'],
          ['albums-outline', 'Every exhibit with numbered headers and footers'],
          ['finger-print-outline', 'Hash manifest page with SHA-256 for each exhibit'],
          ['code-slash-outline', 'Manifest as CSV and JSON, plus a ZIP bundle'],
        ].map(([icon, text]) => (
          <View key={text} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={c.primary} />
            <T style={{ flex: 1 }}>{text}</T>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 0, paddingVertical: space.sm }}>
        <Row
          title="Use latest versions"
          subtitle={useLatest ? `Signed/annotated versions where they exist (${derivedCount})` : 'Original captures only (Version 1)'}
          right={<Switch value={useLatest} onValueChange={setUseLatest} accessibilityLabel="Use latest versions" />}
        />
        <Divider />
        <Row
          title="Embed exhibit files"
          subtitle="Attach the exact exhibit PDFs inside the packet so recipients can re-hash them"
          right={<Switch value={embed} onValueChange={setEmbed} accessibilityLabel="Embed exhibit files" />}
        />
      </Card>

      {error ? <Banner tone="danger" icon="alert-circle" title="Packet not created" body={error} /> : null}

      <Button title={progress ?? (result ? 'Generate Again' : 'Generate Packet')} icon="briefcase" onPress={run} loading={!!progress} disabled={!data?.exhibits.length} />

      {result ? (
        <>
          <Banner tone="success" icon="checkmark-circle" title="Packet ready" body={`${result.exhibitCount} exhibits · ${result.pageCount} pages. Custody entries were added to every exhibit. Tap a file to share or save it.`} />
          <Card style={{ paddingVertical: space.sm, gap: 0 }}>
            <FileRow file={result.packet} icon="document-text" title="Evidence packet (PDF)" subtitle={result.packet.name} />
            <Divider />
            <FileRow file={result.bundle} icon="archive" title="Complete bundle (ZIP)" subtitle="Packet, exhibits, manifests, README" />
            <Divider />
            <FileRow file={result.manifestCsv} icon="grid" title="Hash manifest (CSV)" subtitle="Opens in Numbers or Excel" />
            <Divider />
            <FileRow file={result.manifestJson} icon="code-slash" title="Hash manifest (JSON)" subtitle="Machine-readable" />
          </Card>
          <HashText label="Packet SHA-256" hash={result.packet.sha256} note="Recorded in the manifests and in each exhibit's custody log." />
        </>
      ) : null}
    </Screen>
  );
}
