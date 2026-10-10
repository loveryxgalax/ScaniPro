import Svg, { Path, Text as SvgText } from 'react-native-svg';

import type { Annotation, NormPoint } from '@/lib/core/types';

export function pointsToPath(points: NormPoint[], w: number, h: number): string {
  if (!points.length) return '';
  const [first, ...rest] = points as [NormPoint, ...NormPoint[]];
  let d = `M ${first[0] * w} ${first[1] * h}`;
  if (!rest.length) d += ` L ${first[0] * w + 0.5} ${first[1] * h}`;
  for (const [x, y] of rest) d += ` L ${x * w} ${y * h}`;
  return d;
}

/** Renders annotations in normalised page space over an image of size w×h. */
export function AnnotationOverlay({ annotations, pageIndex, width, height }: { annotations: Annotation[]; pageIndex: number; width: number; height: number }) {
  const items = annotations.filter((a) => a.pageIndex === pageIndex);
  if (!items.length) return null;
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      {items.map((a, i) =>
        a.kind === 'text' ? (
          <SvgText key={i} x={a.x * width} y={a.y * height + a.size * width} fontSize={a.size * width} fill={a.color} fontWeight="600">
            {a.text}
          </SvgText>
        ) : (
          <Path
            key={i}
            d={pointsToPath(a.points, width, height)}
            stroke={a.color}
            strokeWidth={Math.max(1, a.width * width)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ),
      )}
    </Svg>
  );
}
