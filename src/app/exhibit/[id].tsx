import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, View, useWindowDimensions } from 'react-native';

import { AnnotationOverlay } from '@/components/AnnotationOverlay';
import { PromptModal } from '@/components/PromptModal';
import { Badge, Banner, Button, Card, Divider, EmptyState, HashText, IconButton, IconChip, Loading, Screen, SealPill, Segmented, T } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { annotationsForVersion } from '@/lib/annotations';
import { confirm, showActionSheet } from '@/lib/actionSheet';
import { ACTION_LABELS } from '@/lib/core/custody';
import { canUse } from '@/lib/core/limits';
import { shortHash } from '@/lib/core/text';
import { getDb } from '@/lib/db';
import { listCustody, verifyCustody } from '@/lib/db/custody';
import { getCase, getExhibit, listPages, listVersions } from '@/lib/db/queries';
import type { CustodyRow } from '@/lib/db/types';
import { formatDateTime } from '@/lib/format';
import { passGate } from '@/lib/gates';
import { toAbsolute } from '@/lib/platform/files';
import {
  renameExhibit,
  shareExhibitVersion,
  verifyExhibit,
  versionLabel,
  withdrawExhibit,
  type VerificationReport,
} from '@/lib/services/exhibits';
import { useIsPro } from '@/lib/state/pro';
import { radius, space, useTheme } from '@/theme';

type Tab = 'pages' | 'text' | 'integrity' | 'custody';

const ACTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  captured: 'camera',
  ocr_completed: 'text',
  ocr_failed: 'alert-circle',
  pdf_generated: 'document',
  renamed: 'pencil',
  annotated: 'brush',
  signed: 'create',
  exported: 'briefcase',
  shared: 'share-outline',
  verified: 'shield-checkmark',
  verification_failed: 'warning',
  deleted: 'trash',
};

function CustodyEntryView({ row, last }: { row: CustodyRow; last: boolean }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const details = JSON.parse(row.details) as Record<string, unknown>;
  const bad = row.action === 'verification_failed' || row.action === 'ocr_failed';
  return (
    <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityHint="Shows full entry details">
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ alignItems: 'center' }}>
          {bad ? <IconChip icon={ACTION_ICONS[row.action] ?? 'ellipse'} size={32} tone="danger" /> : <IconChip icon={ACTION_ICONS[row.action] ?? 'ellipse'} size={32} />}
          {!last ? <View style={{ width: 2, flex: 1, backgroundColor: c.borderStrong, marginVertical: 3, borderRadius: 1 }} /> : null}
        </View>
        <View style={{ flex: 1, paddingBottom: space.lg, gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="heading" style={{ fontSize: 15 }}>{ACTION_LABELS[row.action] ?? row.action}</T>
            <T variant="caption">#{row.seq}</T>
          </View>
          <T variant="caption">{formatDateTime(row.timestamp)}</T>
          <T variant="mono" style={{ fontSize: 11 }}>{row.timestamp}</T>
          <T variant="caption">{row.device_model} · {row.os_name} {row.os_version} · ScaniPro {row.app_version} ({row.app_build})</T>
          <T variant="mono" style={{ fontSize: 11 }}>file {shortHash(row.file_sha256, 10)}</T>
          {open ? (
            <View style={{ marginTop: space.sm, gap: space.sm }}>
              <HashText label="File SHA-256 after action" hash={row.file_sha256} />
              <HashText label="Previous entry hash" hash={row.prev_entry_hash} />
              <HashText label="This entry hash" hash={row.entry_hash} />
              <T variant="label">Details</T>
              <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.sm, padding: space.md, borderWidth: 1, borderColor: c.border }}>
                <T variant="mono" selectable>{JSON.stringify(details, null, 2)}</T>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function ExhibitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const isPro = useIsPro();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('pages');
  const [versionId, setVersionId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [report, setReport] = useState<VerificationReport | null>(null);

  const { data, loading } = useQuery(async () => {
    const db = await getDb();
    const exhibit = await getExhibit(db, id);
    if (!exhibit) return null;
    const [kase, pages, versions, custody, chain] = await Promise.all([
      getCase(db, exhibit.case_id),
      listPages(db, id),
      listVersions(db, id),
      listCustody(db, id),
      verifyCustody(db, id),
    ]);
    return { exhibit, kase, pages, versions, custody, chain };
  }, [id]);

  if (loading && !data) return <Loading />;
  if (!data || data.exhibit.deleted_at) {
    return <EmptyState icon="alert-circle-outline" title="Exhibit not available" body="It may have been withdrawn." />;
  }
  const { exhibit, pages, versions, custody, chain } = data;
  const selected = versions.find((v) => v.id === (versionId ?? exhibit.current_version_id)) ?? versions[versions.length - 1];
  const annotations = annotationsForVersion(versions, selected?.id);
  const imgW = width - space.lg * 2;
  const processing = !exhibit.current_version_id;

  const annotate = () => {
    if (!selected) return;
    if (passGate(canUse(isPro, 'signatures'))) {
      router.push({ pathname: '/exhibit/annotate', params: { id: exhibit.id, versionId: selected.id } });
    }
  };

  const share = async () => {
    if (!selected) return;
    try {
      await shareExhibitVersion(exhibit.id, selected.id);
    } catch (e) {
      Alert.alert('Could not share', (e as Error).message);
    }
  };

  const verify = async () => {
    setVerifying(true);
    try {
      setReport(await verifyExhibit(exhibit.id));
      setTab('integrity');
    } catch (e) {
      Alert.alert('Verification error', (e as Error).message);
    } finally {
      setVerifying(false);
    }
  };

  const menu = () =>
    showActionSheet(`Exhibit ${exhibit.number}`, [
      { label: 'Rename', onPress: () => setRenaming(true) },
      { label: 'Annotate or Sign (new version)', onPress: annotate },
      { label: 'Share PDF', onPress: () => void share() },
      { label: 'Verify Integrity', onPress: () => void verify() },
      {
        label: 'Withdraw Exhibit…',
        destructive: true,
        onPress: () =>
          confirm(
            `Withdraw Exhibit ${exhibit.number}?`,
            'The files are deleted from this iPhone. The exhibit number is never reused, and its custody log is kept and closed with a "Withdrawn" entry so packets show the gap honestly.',
            'Withdraw',
            () => setWithdrawing(true),
          ),
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: `Exhibit ${exhibit.number}`,
          headerRight: () => <IconButton icon="ellipsis-horizontal-circle" label="Exhibit actions" onPress={menu} />,
        }}
      />
      <Screen>
        <View style={{ gap: space.sm }}>
          <Pressable onPress={() => setRenaming(true)} accessibilityRole="button" accessibilityHint="Rename this exhibit">
            <T variant="display">{exhibit.title}</T>
          </Pressable>
          <T variant="caption">
            {data.kase?.title} · captured {formatDateTime(exhibit.captured_at)} · {exhibit.page_count} page{exhibit.page_count > 1 ? 's' : ''}
          </T>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <SealPill ok={chain.ok} text={chain.ok ? 'Custody chain intact' : 'Custody chain broken'} />
            {processing ? <Badge text="Processing…" tone="primary" icon="hourglass-outline" /> : null}
            {selected ? <Badge text={versionLabel(selected)} tone={selected.kind === 'original' ? 'neutral' : 'warning'} /> : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button title="Share PDF" icon="share-outline" variant="secondary" onPress={() => void share()} disabled={!selected} style={{ flex: 1 }} />
          <Button title="Sign" icon="create-outline" variant="secondary" onPress={annotate} disabled={!selected} style={{ flex: 1 }} />
        </View>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pages', label: 'Pages' },
            { value: 'text', label: 'Text' },
            { value: 'integrity', label: 'Integrity' },
            { value: 'custody', label: `Log (${custody.length})` },
          ]}
        />

        {tab === 'pages' ? (
          <View style={{ gap: space.md }}>
            {versions.length > 1 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {versions.map((v) => (
                  <Pressable key={v.id} onPress={() => setVersionId(v.id)} accessibilityRole="button" accessibilityState={{ selected: v.id === selected?.id }}>
                    <Badge text={v.kind === 'original' ? 'v1 Original' : `v${v.version}`} tone={v.id === selected?.id ? 'primary' : 'neutral'} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            {selected && selected.kind === 'derived' ? (
              <Banner tone="warning" icon="git-branch-outline" title="Derived version" body={`${selected.description}. The original capture is unchanged and remains Version 1.`} />
            ) : null}
            {pages.map((p) => {
              const h = (imgW * p.height) / p.width;
              return (
                <View key={p.id} style={{ gap: 6 }}>
                  <View style={{ width: imgW, height: h, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: c.border, backgroundColor: c.paper }}>
                    <Image source={{ uri: toAbsolute(p.original_path).uri }} style={{ width: imgW, height: h }} accessibilityLabel={`Page ${p.page_index + 1}`} />
                    <AnnotationOverlay annotations={annotations} pageIndex={p.page_index} width={imgW} height={h} />
                  </View>
                  <T variant="caption">Page {p.page_index + 1} · {p.width}×{p.height}px · SHA-256 {shortHash(p.sha256, 6)}</T>
                </View>
              );
            })}
          </View>
        ) : null}

        {tab === 'text' ? (
          <View style={{ gap: space.md }}>
            {exhibit.ocr_status === 'pending' || exhibit.ocr_status === 'running' ? (
              <Banner icon="hourglass-outline" title="Recognising text on this iPhone…" body="This takes a few seconds per page. Nothing is uploaded." />
            ) : null}
            {exhibit.ocr_status === 'failed' ? (
              <Banner tone="warning" icon="alert-circle-outline" title="No text could be recognised" body="The exhibit is still sealed and usable; it just isn't searchable." />
            ) : null}
            {exhibit.ocr_status === 'done' ? (
              <Button
                title="Copy All Text"
                icon="copy-outline"
                variant="secondary"
                onPress={async () => {
                  await Clipboard.setStringAsync(pages.map((p) => p.ocr_text ?? '').join('\n\n'));
                  Alert.alert('Copied', 'The recognised text is on the clipboard.');
                }}
              />
            ) : null}
            {pages.map((p) => (
              <Card key={p.id}>
                <T variant="label">Page {p.page_index + 1}</T>
                <T selectable style={{ marginTop: space.sm }}>{p.ocr_text?.trim() || (p.ocr_text === null ? '…' : 'No text on this page.')}</T>
              </Card>
            ))}
          </View>
        ) : null}

        {tab === 'integrity' ? (
          <View style={{ gap: space.md }}>
            {report ? (
              report.ok ? (
                <Banner tone="success" icon="shield-checkmark" title="Integrity verified" body={`All ${report.pages.length} original pages, ${report.versions.length} file version(s) and ${report.custody.entries} custody entries match their recorded hashes. Checked ${formatDateTime(report.checkedAt)}.`} />
              ) : (
                <Banner tone="danger" icon="warning" title="Integrity check failed" body={[
                  ...report.pages.filter((p) => !p.ok).map((p) => `Page ${p.index + 1} ${p.actual ? 'changed' : 'is missing'}.`),
                  ...report.versions.filter((v) => !v.ok).map((v) => `Version ${v.version} ${v.actual ? 'changed' : 'is missing'}.`),
                  report.captureDigestOk ? '' : 'Capture digest does not match.',
                  report.custody.ok ? '' : `Custody log: ${report.custody.reason} at entry ${report.custody.brokenAtSeq}.`,
                ].filter(Boolean).join(' ')} />
              )
            ) : null}
            <Button title="Verify Integrity Now" icon="shield-checkmark-outline" onPress={() => void verify()} loading={verifying} />
            <Card style={{ gap: space.md }}>
              <HashText label="Capture digest (original pages)" hash={exhibit.capture_digest} note="SHA-256 over the ordered page hashes, fixed at capture. Long-press any hash to copy." />
              <Divider />
              {pages.map((p) => (
                <HashText key={p.id} label={`Page ${p.page_index + 1} original image`} hash={p.sha256} />
              ))}
            </Card>
            <T variant="label">File versions</T>
            {versions.map((v) => (
              <Card key={v.id} style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T variant="heading">{versionLabel(v)}</T>
                  {v.id === exhibit.current_version_id ? <Badge text="Current" tone="primary" /> : null}
                </View>
                <T variant="caption">{v.description} · {formatDateTime(v.created_at)}</T>
                <HashText label="PDF SHA-256" hash={v.sha256} />
                {v.parent_version_id ? (
                  <T variant="caption">Derived from version {versions.find((x) => x.id === v.parent_version_id)?.version ?? '?'}</T>
                ) : null}
              </Card>
            ))}
            <Button title="How evidence is protected" variant="ghost" onPress={() => router.push('/integrity')} />
          </View>
        ) : null}

        {tab === 'custody' ? (
          <View style={{ gap: space.md }}>
            <Banner
              tone={chain.ok ? 'success' : 'danger'}
              icon={chain.ok ? 'link' : 'warning'}
              title={chain.ok ? `Hash chain intact · ${chain.entries} entries` : 'Hash chain broken'}
              body={chain.ok ? 'Each entry is sealed with the hash of the one before it. Entries can only be added, never edited or removed. Tap an entry for full details.' : `${chain.reason} at entry ${chain.brokenAtSeq}.`}
            />
            <View>
              {custody.map((row, i) => (
                <CustodyEntryView key={row.id} row={row} last={i === custody.length - 1} />
              ))}
            </View>
          </View>
        ) : null}
      </Screen>

      <PromptModal
        visible={renaming}
        title="Rename exhibit"
        message="The new name is recorded in the custody log. The file itself is not changed."
        initial={exhibit.title}
        confirmLabel="Rename"
        onCancel={() => setRenaming(false)}
        onSubmit={async (v) => {
          try {
            await renameExhibit(exhibit.id, v);
            setRenaming(false);
          } catch (e) {
            Alert.alert('Could not rename', (e as Error).message);
          }
        }}
      />
      <PromptModal
        visible={withdrawing}
        title="Reason for withdrawal"
        message="Recorded in the custody log."
        initial=""
        placeholder="e.g. Duplicate scan"
        confirmLabel="Withdraw"
        onCancel={() => setWithdrawing(false)}
        onSubmit={async (reason) => {
          setWithdrawing(false);
          try {
            await withdrawExhibit(exhibit.id, reason);
            router.back();
          } catch (e) {
            Alert.alert('Could not withdraw', (e as Error).message);
          }
        }}
      />
    </>
  );
}
