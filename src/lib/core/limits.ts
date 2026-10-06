export const FREE_LIMITS = { cases: 1, exhibits: 5 } as const;

export type ProFeature = 'unlimited_cases' | 'unlimited_exhibits' | 'packet_export' | 'signatures';

export type Gate = { allowed: true } | { allowed: false; feature: ProFeature; reason: string };

export function canCreateCase(isPro: boolean, activeCases: number): Gate {
  if (isPro || activeCases < FREE_LIMITS.cases) return { allowed: true };
  return {
    allowed: false,
    feature: 'unlimited_cases',
    reason: `The free version includes ${FREE_LIMITS.cases} case. Upgrade to Pro for unlimited cases.`,
  };
}

export function canAddExhibit(isPro: boolean, activeExhibits: number): Gate {
  if (isPro || activeExhibits < FREE_LIMITS.exhibits) return { allowed: true };
  return {
    allowed: false,
    feature: 'unlimited_exhibits',
    reason: `The free version includes ${FREE_LIMITS.exhibits} exhibits. Upgrade to Pro for unlimited exhibits.`,
  };
}

export function canUse(isPro: boolean, feature: 'packet_export' | 'signatures'): Gate {
  if (isPro) return { allowed: true };
  return {
    allowed: false,
    feature,
    reason:
      feature === 'packet_export'
        ? 'Evidence packet export is part of ScaniPro Pro.'
        : 'Signatures and annotations are part of ScaniPro Pro.',
  };
}
