import { useRef, useState, type ReactNode } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { NormPoint } from '@/lib/core/types';

import { pointsToPath } from './AnnotationOverlay';

/**
 * Captures finger strokes in normalised coordinates (0..1) over a w×h area.
 * When `onTap` is set, single taps are reported instead of drawing.
 */
export function DrawSurface({
  width,
  height,
  color,
  strokeWidth,
  enabled,
  onStroke,
  onTap,
  children,
}: {
  width: number;
  height: number;
  color: string;
  /** Fraction of width. */
  strokeWidth: number;
  enabled: boolean;
  onStroke?: (points: NormPoint[]) => void;
  onTap?: (point: NormPoint) => void;
  children?: ReactNode;
}) {
  const [live, setLive] = useState<NormPoint[]>([]);
  const points = useRef<NormPoint[]>([]);

  const at = (e: GestureResponderEvent): NormPoint => [
    Math.min(1, Math.max(0, e.nativeEvent.locationX / width)),
    Math.min(1, Math.max(0, e.nativeEvent.locationY / height)),
  ];

  return (
    <View
      style={{ width, height }}
      onStartShouldSetResponder={() => enabled}
      onMoveShouldSetResponder={() => enabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        points.current = [at(e)];
        if (!onTap) setLive(points.current);
      }}
      onResponderMove={(e) => {
        if (onTap) return;
        points.current = [...points.current, at(e)];
        setLive(points.current);
      }}
      onResponderRelease={() => {
        const pts = points.current;
        points.current = [];
        setLive([]);
        if (onTap && pts[0]) onTap(pts[0]);
        else if (pts.length) onStroke?.(pts);
      }}
    >
      {children}
      {live.length ? (
        <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
          <Path d={pointsToPath(live, width, height)} stroke={color} strokeWidth={Math.max(1, strokeWidth * width)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      ) : null}
    </View>
  );
}
