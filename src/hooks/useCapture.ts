import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { showActionSheet } from '@/lib/actionSheet';
import { canAddExhibit } from '@/lib/core/limits';
import { getDb } from '@/lib/db';
import { countActive, listCases } from '@/lib/db/queries';
import { passGate } from '@/lib/gates';
import { importFromFiles, importFromPhotos, scanBook, scanDocument } from '@/lib/services/imports';
import { proStore } from '@/lib/state/pro';

export type CaptureMode = 'scan' | 'book' | 'photos' | 'files';

/** Asks which case to use (skipping the question when there is only one). */
export async function chooseCase(title: string): Promise<string | null> {
  const cases = await listCases(await getDb());
  if (!cases.length) {
    Alert.alert('Create a case first', 'Every exhibit belongs to a case: one per matter, claim or investigation.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New Case', onPress: () => router.push('/case/new') },
    ]);
    return null;
  }
  if (cases.length === 1) return (cases[0] as { id: string }).id;
  return new Promise((resolve) => {
    showActionSheet(
      title,
      cases.slice(0, 12).map((k) => ({ label: k.reference ? `${k.title} · ${k.reference}` : k.title, onPress: () => resolve(k.id) })),
    );
    // Cancelling the sheet never resolves; the caller simply stays where it is.
  });
}

/** Shared scan / import flow with gating, a busy overlay and navigation to the result. */
export function useCapture() {
  const [busy, setBusy] = useState<string | null>(null);

  const start = async (mode: CaptureMode, caseId?: string) => {
    const counts = await countActive(await getDb());
    if (!passGate(canAddExhibit(proStore.get().isPro, counts.exhibits))) return;
    const target = caseId ?? (await chooseCase(mode === 'photos' || mode === 'files' ? 'Import into which case?' : 'Scan into which case?'));
    if (!target) return;
    try {
      let ids: string[] = [];
      if (mode === 'scan') ids = [await scanDocument(target, setBusy)].filter((x): x is string => !!x);
      if (mode === 'book') ids = [await scanBook(target, setBusy)].filter((x): x is string => !!x);
      if (mode === 'photos') ids = [await importFromPhotos(target, setBusy)].filter((x): x is string => !!x);
      if (mode === 'files') ids = await importFromFiles(target, setBusy);
      if (ids.length === 1) router.push({ pathname: '/exhibit/[id]', params: { id: ids[0] as string } });
      else if (ids.length > 1 && !caseId) router.push({ pathname: '/case/[id]', params: { id: target } });
    } catch (e) {
      const msg = (e as Error).message;
      Alert.alert(mode === 'scan' || mode === 'book' ? 'Scan failed' : 'Import failed', mode === 'scan' || mode === 'book' ? `${msg}\n\nCheck that CaseSeal has camera access in iOS Settings.` : msg);
    } finally {
      setBusy(null);
    }
  };

  return { busy, start };
}
