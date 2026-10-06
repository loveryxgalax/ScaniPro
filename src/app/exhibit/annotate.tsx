import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AnnotationOverlay, pointsToPath } from '@/components/AnnotationOverlay';
import { DrawSurface } from '@/components/DrawSurface';
import { PromptModal } from '@/components/PromptModal';
import { Button, Loading, T } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { annotationsForVersion } from '@/lib/annotations';
import type { Annotation, NormPoint } from '@/lib/core/types';
import { getDb } from '@/lib/db';
import { getExhibit, listPages, listVersions } from '@/lib/db/queries';
import { toAbsolute } from '@/lib/platform/files';
import { createDerivedVersion } from '@/lib/services/exhibits';
import { radius, space, useTheme } from '@/theme';

type Tool = 'pen' | 'text' | 'signature';
const COLORS = ['#0E1726', '#1D3A8A', '#B42318'];
const PEN_WIDTH = 0.004;
const SIG_WIDTH = 0.0035;
const SIG_ASPECT = 3; // pad width : height
const SIG_PAGE_WIDTH = 0.4; // placed signature width as a fraction of page width

export default function AnnotateScreen() {
  const { id, versionId } = useLocalSearchParams<{ id: string; versionId: string }>();
  const c = useTheme();
  const [pageIndex, setPageIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[1] as string);
  const [items, setItems] = useState<Annotation[]>([]);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [textAt, setTextAt] = useState<NormPoint | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [signature, setSignature] = useState<NormPoint[][] | null>(null);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery(async () => {
    const db = await getDb();
    const [exhibit, pages, versions] = await Promise.all([getExhibit(db, id), listPages(db, id), listVersions(db, id)]);
    return { exhibit, pages, versions };
  }, [id]);

  if (!data?.exhibit) return <Loading />;
  const { exhibit, pages, versions } = data;
  const base = versions.find((v) => v.id === versionId);
  const page = pages[pageIndex];
  if (!page || !base) return <Loading />;
  const existing = annotationsForVersion(versions, base.id);

  const aspect = page.height / page.width;
  const fitW = Math.min(area.w, area.h / aspect);
  const canvas = { w: fitW, h: fitW * aspect };

  const add = (a: Annotation) => setItems((prev) => [...prev, a]);

  const placeSignature = (at: NormPoint) => {
    if (!signature) return;
    const sw = SIG_PAGE_WIDTH;
    const sh = (SIG_PAGE_WIDTH / SIG_ASPECT) * (page.width / page.height);
    const x0 = Math.min(1 - sw, Math.max(0, at[0] - sw / 2));
    const y0 = Math.min(1 - sh, Math.max(0, at[1] - sh / 2));
    for (const stroke of signature) {
      add({ kind: 'signature', pageIndex, color, width: SIG_WIDTH, points: stroke.map(([x, y]) => [x0 + x * sw, y0 + y * sh]) });
    }
  };

  const save = () => {
    Alert.alert(
      'Create a new version?',
      `Your changes will be saved as Version ${Math.max(...versions.map((v) => v.version)) + 1}, with its own SHA-256 and custody entry. The original capture is never modified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Version',
          onPress: async () => {
            setSaving(true);
            try {
              await createDerivedVersion(exhibit.id, base.id, items);
              router.back();
            } catch (e) {
              Alert.alert('Could not save', (e as Error).message);
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const toolButton = (t: Tool, icon: keyof typeof Ionicons.glyphMap, label: string) => (
    <Pressable
      onPress={() => {
        setTool(t);
        if (t === 'signature' && !signature) setPadOpen(true);
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: tool === t }}
      style={{ alignItems: 'center', gap: 2, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.md, backgroundColor: tool === t ? c.primarySoft : 'transparent' }}
    >
      <Ionicons name={icon} size={22} color={tool === t ? c.primary : c.textMuted} />
      <T variant="caption" style={{ fontSize: 11 }} color={tool === t ? c.primary : c.textMuted}>{label}</T>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm }}>
        <Pressable onPress={() => (items.length ? Alert.alert('Discard changes?', undefined, [{ text: 'Keep Editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => router.back() }]) : router.back())} hitSlop={10}>
          <T color={c.primary}>Cancel</T>
        </Pressable>
        <T variant="heading">Exhibit {exhibit.number}</T>
        <Pressable onPress={save} disabled={!items.length || saving} hitSlop={10}>
          <T color={items.length ? c.primary : c.textFaint} style={{ fontWeight: '700' }}>{saving ? 'Saving…' : 'Save'}</T>
        </Pressable>
      </View>

      <T variant="caption" style={{ textAlign: 'center', paddingHorizontal: space.lg }}>
        {tool === 'pen' ? 'Draw with your finger.' : tool === 'text' ? 'Tap where the note should go.' : signature ? 'Tap the page to place your signature.' : 'Draw your signature first.'}
      </T>

      <View style={{ flex: 1, margin: space.lg, alignItems: 'center', justifyContent: 'center' }} onLayout={(e: LayoutChangeEvent) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {canvas.w > 0 ? (
          <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: '#fff' }}>
            <DrawSurface
              width={canvas.w}
              height={canvas.h}
              color={color}
              strokeWidth={PEN_WIDTH}
              enabled={!saving}
              onStroke={tool === 'pen' ? (points) => add({ kind: 'ink', pageIndex, color, width: PEN_WIDTH, points }) : undefined}
              onTap={tool === 'text' ? setTextAt : tool === 'signature' ? (p) => (signature ? placeSignature(p) : setPadOpen(true)) : undefined}
            >
              <Image source={{ uri: toAbsolute(page.original_path).uri }} style={{ width: canvas.w, height: canvas.h }} />
              <AnnotationOverlay annotations={existing} pageIndex={pageIndex} width={canvas.w} height={canvas.h} />
              <AnnotationOverlay annotations={items} pageIndex={pageIndex} width={canvas.w} height={canvas.h} />
            </DrawSurface>
          </View>
        ) : null}
      </View>

      {pages.length > 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
          <Pressable onPress={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={pageIndex === 0} hitSlop={10} accessibilityLabel="Previous page">
            <Ionicons name="chevron-back" size={22} color={pageIndex === 0 ? c.textFaint : c.primary} />
          </Pressable>
          <T variant="caption">Page {pageIndex + 1} of {pages.length}</T>
          <Pressable onPress={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))} disabled={pageIndex === pages.length - 1} hitSlop={10} accessibilityLabel="Next page">
            <Ionicons name="chevron-forward" size={22} color={pageIndex === pages.length - 1 ? c.textFaint : c.primary} />
          </Pressable>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderColor: c.border }}>
        {toolButton('pen', 'brush-outline', 'Pen')}
        {toolButton('text', 'text-outline', 'Text')}
        {toolButton('signature', 'create-outline', 'Sign')}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {COLORS.map((col) => (
            <Pressable key={col} onPress={() => setColor(col)} accessibilityLabel={`Colour ${col}`} accessibilityState={{ selected: color === col }} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: col, borderWidth: color === col ? 3 : 1, borderColor: color === col ? c.accent : c.border }} />
          ))}
        </View>
        <Pressable onPress={() => setItems((p) => p.slice(0, -1))} disabled={!items.length} accessibilityLabel="Undo" hitSlop={10}>
          <Ionicons name="arrow-undo" size={24} color={items.length ? c.primary : c.textFaint} />
        </Pressable>
      </View>

      <PromptModal
        visible={!!textAt}
        title="Add a note"
        confirmLabel="Add"
        placeholder="e.g. Received 6 Oct 2026"
        onCancel={() => setTextAt(null)}
        onSubmit={(text) => {
          if (textAt && text.trim()) add({ kind: 'text', pageIndex, color, size: 0.028, x: textAt[0], y: textAt[1], text: text.trim() });
          setTextAt(null);
        }}
      />
      <SignaturePad
        visible={padOpen}
        color={color}
        onCancel={() => setPadOpen(false)}
        onDone={(strokes) => {
          setSignature(strokes);
          setPadOpen(false);
          setTool('signature');
        }}
      />
    </SafeAreaView>
  );
}

function SignaturePad({ visible, color, onCancel, onDone }: { visible: boolean; color: string; onCancel: () => void; onDone: (s: NormPoint[][]) => void }) {
  const c = useTheme();
  const [strokes, setStrokes] = useState<NormPoint[][]>([]);
  const [w, setW] = useState(0);
  const h = w / SIG_ASPECT;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: c.bg, padding: space.xl, gap: space.lg }}>
        <T variant="title">Draw your signature</T>
        <T variant="caption">Your signature is drawn into a new version of this exhibit. It is never stored separately or reused without you placing it.</T>
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
          {w > 0 ? (
            <View style={{ backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
              <DrawSurface width={w} height={h} color={color} strokeWidth={SIG_WIDTH * 2.5} enabled onStroke={(p) => setStrokes((s) => [...s, p])}>
                <Svg width={w} height={h} style={{ position: 'absolute' }}>
                  <Path d={`M ${w * 0.06} ${h * 0.8} L ${w * 0.94} ${h * 0.8}`} stroke="#C9D0DB" strokeWidth={1} />
                  {strokes.map((s, i) => (
                    <Path key={i} d={pointsToPath(s, w, h)} stroke={color} strokeWidth={Math.max(1, SIG_WIDTH * 2.5 * w)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  ))}
                </Svg>
              </DrawSurface>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button title="Clear" variant="secondary" onPress={() => setStrokes([])} style={{ flex: 1 }} />
          <Button title="Use Signature" onPress={() => onDone(strokes)} disabled={!strokes.length} style={{ flex: 1 }} />
        </View>
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Modal>
  );
}
