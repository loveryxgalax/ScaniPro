import type { Annotation } from './core/types';
import type { VersionRow } from './db/types';

/** All annotations visible in a version: its own plus every ancestor's. */
export function annotationsForVersion(versions: VersionRow[], versionId: string | null | undefined): Annotation[] {
  const byId = new Map(versions.map((v) => [v.id, v]));
  const chain: Annotation[][] = [];
  let cur = versionId ? byId.get(versionId) : undefined;
  let guard = 0;
  while (cur && guard++ < 100) {
    if (cur.annotations) chain.unshift(JSON.parse(cur.annotations) as Annotation[]);
    cur = cur.parent_version_id ? byId.get(cur.parent_version_id) : undefined;
  }
  return chain.flat();
}
