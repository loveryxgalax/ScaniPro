export const FREE_LIMITS = { cases: 1, exhibits: 5 } as const;

export type ProFeature = 'unlimited_cases' | 'unlimited_exhibits' | 'packet_export' | 'signatures' | 'office_export' | 'merge' | 'expense_report';

type ProOnly = Exclude<ProFeature, 'unlimited_cases' | 'unlimited_exhibits'>;

const PRO_REASONS: Record<ProOnly, string> = {
  packet_export: 'Evidence packet export is part of ScaniPro Pro.',
  signatures: 'Signatures and annotations are part of ScaniPro Pro.',
  office_export: 'Word and PowerPoint export are part of ScaniPro Pro.',
  merge: 'Merging exhibits into one PDF is part of ScaniPro Pro.',
  expense_report: 'Expense reports are part of ScaniPro Pro.',
};

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

export function canUse(isPro: boolean, feature: ProOnly): Gate {
  if (isPro) return { allowed: true };
  return { allowed: false, feature, reason: PRO_REASONS[feature] };
}
