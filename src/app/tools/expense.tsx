import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Switch, TextInput, View } from 'react-native';

import { BusyModal } from '@/components/BusyModal';
import { Banner, Button, Card, Divider, EmptyState, Row, Screen, T } from '@/components/ui';
import { expenseTotals } from '@/lib/core/expense';
import { formatMoney, parseReceipt } from '@/lib/core/receipt';
import { getDb } from '@/lib/db';
import { getCase, listExhibits, listPages } from '@/lib/db/queries';
import { exportExpenseReport, type ExpenseDraft } from '@/lib/services/exports';
import { shareExport, type ExportedFile } from '@/lib/services/share';
import { radius, space, useTheme } from '@/theme';

type Draft = ExpenseDraft & { include: boolean; amountText: string };

export default function ExpenseScreen() {
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const c = useTheme();
  const [caseTitle, setCaseTitle] = useState('');
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [files, setFiles] = useState<{ pdf: ExportedFile; csv: ExportedFile } | null>(null);

  useEffect(() => {
    void (async () => {
      const db = await getDb();
      const kase = await getCase(db, caseId);
      setCaseTitle(kase?.title ?? '');
      const exhibits = (await listExhibits(db, caseId)).filter((e) => e.current_version_id && e.kind === 'pages');
      const out: Draft[] = [];
      for (const e of exhibits) {
        const text = (await listPages(db, e.id)).map((p) => p.ocr_text ?? '').join('\n');
        const r = parseReceipt(text);
        out.push({
          exhibitId: e.id,
          exhibitNumber: e.number,
          exhibitTitle: e.title,
          date: r.date,
          merchant: r.merchant,
          amount: r.total ?? 0,
          amountText: r.total !== null ? r.total.toFixed(2) : '',
          currency: r.currency,
          include: r.total !== null,
        });
      }
      setDrafts(out);
    })();
  }, [caseId]);

  if (!drafts) return <BusyModal label="Reading receipts…" note="Using text recognised on device" />;
  if (!drafts.length) return <EmptyState icon="receipt" title="No receipts yet" body="Scan or photograph receipts into this case first. Their totals are read automatically." />;

  const update = (id: string, patch: Partial<Draft>) => setDrafts((prev) => (prev ?? []).map((d) => (d.exhibitId === id ? { ...d, ...patch } : d)));
  const included = drafts.filter((d) => d.include && d.amount > 0);

  const generate = async () => {
    setBusy('Building expense report…');
    try {
      const result = await exportExpenseReport(caseId, included.map(({ include: _i, amountText: _a, ...d }) => d));
      setFiles(result);
    } catch (e) {
      Alert.alert('Could not build report', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <T variant="title">Expense report</T>
      <T variant="caption">{caseTitle} · totals were read from each receipt on this iPhone. Check and correct them before exporting.</T>
      {drafts.map((d) => (
        <Card key={d.exhibitId} style={{ gap: space.sm, opacity: d.include ? 1 : 0.6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700' }} numberOfLines={1}>Ex. {d.exhibitNumber} · {d.exhibitTitle}</T>
              <T variant="caption" numberOfLines={1}>{[d.merchant, d.date].filter(Boolean).join(' · ') || 'No merchant or date found'}</T>
            </View>
            <Switch value={d.include} onValueChange={(v) => update(d.exhibitId, { include: v })} accessibilityLabel={`Include exhibit ${d.exhibitNumber}`} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <TextInput
              value={d.currency ?? ''}
              onChangeText={(t) => update(d.exhibitId, { currency: t.trim().toUpperCase().slice(0, 4) || null })}
              placeholder="CUR"
              placeholderTextColor={c.textFaint}
              autoCapitalize="characters"
              style={{ width: 64, color: c.text, backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: c.border, fontWeight: '700' }}
              accessibilityLabel="Currency"
            />
            <TextInput
              value={d.amountText}
              onChangeText={(t) => {
                const n = Number(t.replace(/[^\d.]/g, ''));
                update(d.exhibitId, { amountText: t, amount: Number.isFinite(n) ? n : 0, include: Number.isFinite(n) && n > 0 ? true : d.include });
              }}
              placeholder="0.00"
              placeholderTextColor={c.textFaint}
              keyboardType="decimal-pad"
              style={{ flex: 1, color: c.text, backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: c.border, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] }}
              accessibilityLabel="Amount"
            />
          </View>
        </Card>
      ))}
      <Card style={{ paddingVertical: space.sm, gap: 0 }}>
        {expenseTotals(included.map((d) => ({ ...d, fileSha256: '' }))).map((t) => (
          <Row key={t.currency ?? 'none'} title={`Total${t.currency ? ` (${t.currency})` : ''}`} right={<T style={{ fontWeight: '800', fontSize: 17 }}>{formatMoney(t.total, t.currency)}</T>} />
        ))}
        {!included.length ? <Row title="No receipts included" /> : null}
      </Card>
      <Button title={`Export Report (${included.length})`} icon="receipt" onPress={() => void generate()} disabled={!included.length} />
      {files ? (
        <>
          <Banner tone="success" icon="checkmark-circle" title="Expense report ready" body="Each included exhibit's custody log records this export." />
          <Card style={{ paddingVertical: space.sm, gap: 0 }}>
            <Row icon="document-text" title="Report (PDF)" subtitle={files.pdf.name} onPress={() => void shareExport(files.pdf)} />
            <Divider />
            <Row icon="grid" title="Spreadsheet (CSV)" subtitle={files.csv.name} onPress={() => void shareExport(files.csv)} />
          </Card>
        </>
      ) : null}
      <BusyModal label={busy} />
    </Screen>
  );
}
