import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';

import { Banner, Button, Card, Loading, Screen, T } from '@/components/ui';
import { chooseCase } from '@/hooks/useCapture';
import { utf8 } from '@/lib/core/text';
import { deleteExternal, readExternal } from '@/lib/platform/files';
import { jpegSize } from '@/lib/core/jpeg';
import { recognizePage } from '@/lib/platform/ocr';
import { scanPages } from '@/lib/platform/scanner';
import { captureExhibit } from '@/lib/services/capture';
import { saveExport, shareExport } from '@/lib/services/share';
import { prefsStore } from '@/lib/state/prefs';
import { space, useTheme } from '@/theme';

/** Scan → recognised text, without creating an exhibit unless the user asks. */
export default function ScanTextScreen() {
  const c = useTheme();
  const [state, setState] = useState<'scanning' | 'reading' | 'done' | 'cancelled'>('scanning');
  const [text, setText] = useState('');
  const uris = useRef<string[]>([]);
  const saved = useRef(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const scanned = await scanPages(prefsStore.get().scanQuality);
        if (!scanned) {
          if (alive) router.back();
          return;
        }
        uris.current = scanned;
        if (alive) setState('reading');
        const parts: string[] = [];
        for (const [i, uri] of scanned.entries()) {
          const { width, height } = jpegSize(await readExternal(uri));
          const r = await recognizePage(uri, width, height);
          parts.push(scanned.length > 1 ? `--- Page ${i + 1} ---\n${r.text}` : r.text);
        }
        if (alive) {
          setText(parts.join('\n\n').trim());
          setState('done');
        }
      } catch (e) {
        Alert.alert('Text scan failed', (e as Error).message);
        if (alive) router.back();
      }
    })();
    return () => {
      alive = false;
      if (!saved.current) uris.current.forEach(deleteExternal);
    };
  }, []);

  if (state !== 'done') return <Loading />;

  return (
    <Screen>
      <T variant="title">Recognised text</T>
      <T variant="caption">Read on this iPhone. Nothing was saved or uploaded.</T>
      <Card>
        <T selectable>{text || 'No text was found on the scanned page.'}</T>
      </Card>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          title="Copy"
          icon="copy-outline"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={async () => {
            await Clipboard.setStringAsync(text);
            Alert.alert('Copied', 'The text is on the clipboard.');
          }}
        />
        <Button
          title="Share .txt"
          icon="share-outline"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={async () => shareExport(await saveExport(`Scanned-text-${new Date().toISOString().slice(0, 10)}.txt`, utf8(`${text}\n`), 'txt'))}
        />
      </View>
      <Button
        title="Save as Exhibit"
        icon="shield-checkmark"
        onPress={async () => {
          const caseId = await chooseCase('Save to which case?');
          if (!caseId) return;
          try {
            saved.current = true;
            const id = await captureExhibit(caseId, uris.current);
            router.replace({ pathname: '/exhibit/[id]', params: { id } });
          } catch (e) {
            saved.current = false;
            Alert.alert('Could not save', (e as Error).message);
          }
        }}
      />
      <Banner tone="primary" icon="information-circle-outline" title="Need it as evidence?" body="Saving seals the scanned pages with SHA-256 and starts a custody log, like any other exhibit." />
      <View style={{ height: 1, backgroundColor: c.border }} />
    </Screen>
  );
}
