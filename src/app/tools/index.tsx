import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View, useWindowDimensions } from 'react-native';

import { BusyModal } from '@/components/BusyModal';
import { IconChip, Screen, T, type IconName } from '@/components/ui';
import { chooseCase, useCapture } from '@/hooks/useCapture';
import { canCreateCase, canUse } from '@/lib/core/limits';
import { getDb } from '@/lib/db';
import { countActive, listExhibits } from '@/lib/db/queries';
import { passGate } from '@/lib/gates';
import { verifyExhibit } from '@/lib/services/exhibits';
import { useIsPro } from '@/lib/state/pro';
import { radius, space, useTheme } from '@/theme';

type Tool = { icon: IconName; label: string; pro?: boolean; onPress: () => void };

function Tile({ tool, width }: { tool: Tool; width: number }) {
  const c = useTheme();
  return (
    <Pressable onPress={tool.onPress} accessibilityRole="button" accessibilityLabel={tool.label} style={({ pressed }) => ({ width, alignItems: 'center', gap: 8, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: width - 8, aspectRatio: 1, maxWidth: 76, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
        <IconChip icon={tool.icon} size={44} />
        {tool.pro ? (
          <View style={{ position: 'absolute', top: -6, right: -6, backgroundColor: c.surfaceStrong, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: c.borderStrong }}>
            <T style={{ fontSize: 9, fontWeight: '800', color: c.accent }}>PRO</T>
          </View>
        ) : null}
      </View>
      <T variant="caption" style={{ textAlign: 'center', color: c.text, fontWeight: '600', fontSize: 12.5 }} numberOfLines={2}>{tool.label}</T>
    </Pressable>
  );
}

export default function ToolsScreen() {
  const isPro = useIsPro();
  const { width } = useWindowDimensions();
  const capture = useCapture();
  const [busy, setBusy] = useState<string | null>(null);
  const tileW = (width - space.lg * 2 - space.sm * 3) / 4;

  const withCase = async (title: string, run: (caseId: string) => void) => {
    const id = await chooseCase(title);
    if (id) run(id);
  };
  const pickExhibit = (action: string) => router.push({ pathname: '/tools/pick', params: { action } });

  const verifyCase = (caseId: string) => {
    void (async () => {
      const exhibits = await listExhibits(await getDb(), caseId);
      if (!exhibits.length) {
        Alert.alert('Nothing to verify', 'This case has no exhibits yet.');
        return;
      }
      let failed: number[] = [];
      try {
        for (const [i, ex] of exhibits.entries()) {
          setBusy(`Verifying ${i + 1} of ${exhibits.length}…`);
          const r = await verifyExhibit(ex.id);
          if (!r.ok) failed = [...failed, ex.number];
        }
      } finally {
        setBusy(null);
      }
      Alert.alert(
        failed.length ? 'Integrity check failed' : 'All exhibits verified',
        failed.length
          ? `Exhibit ${failed.join(', ')} no longer match their recorded hashes. Open them for details.`
          : `${exhibits.length} exhibit${exhibits.length > 1 ? 's' : ''}: every file and custody chain matches. The check was recorded in each custody log.`,
      );
    })();
  };

  const sections: { title: string; tools: Tool[] }[] = [
    {
      title: 'Scan',
      tools: [
        { icon: 'scan', label: 'Document', onPress: () => void capture.start('scan') },
        { icon: 'text', label: 'Text', onPress: () => router.push('/tools/text') },
        { icon: 'book', label: 'Book', onPress: () => void capture.start('book') },
        { icon: 'qr-code', label: 'QR Code', onPress: () => router.push('/tools/qr') },
      ],
    },
    {
      title: 'Create',
      tools: [
        {
          icon: 'folder-open',
          label: 'Case',
          onPress: async () => {
            const counts = await countActive(await getDb());
            if (passGate(canCreateCase(isPro, counts.cases))) router.push('/case/new');
          },
        },
        {
          icon: 'briefcase',
          label: 'Evidence Packet',
          pro: true,
          onPress: () => passGate(canUse(isPro, 'packet_export')) && void withCase('Packet for which case?', (id) => router.push({ pathname: '/export/[caseId]', params: { caseId: id } })),
        },
        {
          icon: 'receipt',
          label: 'Expense Report',
          pro: true,
          onPress: () => passGate(canUse(isPro, 'expense_report')) && void withCase('Expense report for which case?', (id) => router.push({ pathname: '/tools/expense', params: { caseId: id } })),
        },
        {
          icon: 'git-merge',
          label: 'Merge PDFs',
          pro: true,
          onPress: () => passGate(canUse(isPro, 'merge')) && void withCase('Merge exhibits from which case?', (id) => router.push({ pathname: '/tools/merge', params: { caseId: id } })),
        },
      ],
    },
    {
      title: 'Import',
      tools: [
        { icon: 'document-attach', label: 'Files', onPress: () => void capture.start('files') },
        { icon: 'images', label: 'Photos', onPress: () => void capture.start('photos') },
      ],
    },
    {
      title: 'Export',
      tools: [
        { icon: 'document-text', label: 'to Text', onPress: () => pickExhibit('text') },
        { icon: 'image', label: 'to Image', onPress: () => pickExhibit('images') },
        { icon: 'reader', label: 'to Word', pro: true, onPress: () => passGate(canUse(isPro, 'office_export')) && pickExhibit('docx') },
        { icon: 'easel', label: 'to PowerPoint', pro: true, onPress: () => passGate(canUse(isPro, 'office_export')) && pickExhibit('pptx') },
      ],
    },
    {
      title: 'Edit & verify',
      tools: [
        { icon: 'create', label: 'Sign', pro: true, onPress: () => passGate(canUse(isPro, 'signatures')) && pickExhibit('sign') },
        { icon: 'shield-checkmark', label: 'Verify Case', onPress: () => void withCase('Verify which case?', verifyCase) },
        { icon: 'search', label: 'Search', onPress: () => router.push('/search') },
        { icon: 'trash', label: 'Recently Deleted', onPress: () => router.push('/trash') },
      ],
    },
  ];

  return (
    <Screen>
      {sections.map((s) => (
        <View key={s.title} style={{ gap: space.md }}>
          <T variant="heading" style={{ fontSize: 20, fontWeight: '800' }}>{s.title}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, rowGap: space.lg }}>
            {s.tools.map((t) => (
              <Tile key={t.label} tool={t} width={tileW} />
            ))}
          </View>
        </View>
      ))}
      <T variant="caption" style={{ textAlign: 'center', marginTop: space.md }}>Every tool runs on this iPhone. Nothing is uploaded.</T>
      <BusyModal label={capture.busy ?? busy} />
    </Screen>
  );
}
