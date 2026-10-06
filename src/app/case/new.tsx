import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { Button, Field, Screen, T } from '@/components/ui';
import { getDb } from '@/lib/db';
import { getCase } from '@/lib/db/queries';
import { todayIso } from '@/lib/format';
import { createCase, updateCase, validateCase } from '@/lib/services/cases';

export default function NewCaseScreen() {
  const { caseId } = useLocalSearchParams<{ caseId?: string }>();
  const editing = !!caseId;
  const [title, setTitle] = useState('');
  const [reference, setReference] = useState('');
  const [matterDate, setMatterDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    void (async () => {
      const c = await getCase(await getDb(), caseId);
      if (!c) return;
      setTitle(c.title);
      setReference(c.reference ?? '');
      setMatterDate(c.matter_date ?? '');
      setNotes(c.notes ?? '');
    })();
  }, [caseId]);

  const save = async () => {
    const input = { title, reference, matterDate, notes };
    const problem = validateCase(input);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      if (caseId) {
        await updateCase(caseId, input);
        router.back();
      } else {
        const id = await createCase(input);
        router.replace({ pathname: '/case/[id]', params: { id } });
      }
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? 'Edit Case' : 'New Case' }} />
      <Field label="Case title" placeholder="e.g. Smith v. Jones — Lease dispute" value={title} onChangeText={setTitle} autoFocus={!editing} maxLength={120} returnKeyType="next" error={error && !title.trim() ? error : null} />
      <Field label="Reference number (optional)" placeholder="e.g. CV-2026-0142 or claim #" value={reference} onChangeText={setReference} autoCapitalize="characters" maxLength={60} />
      <Field label="Matter date" placeholder="YYYY-MM-DD" value={matterDate} onChangeText={setMatterDate} keyboardType="numbers-and-punctuation" maxLength={10} hint="The incident, filing or claim date this case relates to." error={error && title.trim() ? error : null} />
      <Field label="Notes (optional)" placeholder="Parties, court, adjuster, deadlines…" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} maxLength={2000} />
      <Button title={editing ? 'Save Changes' : 'Create Case'} icon="checkmark" onPress={save} loading={saving} />
      <T variant="caption" style={{ textAlign: 'center' }}>Case details are stored only on this iPhone.</T>
    </Screen>
  );
}
