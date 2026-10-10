import { router } from 'expo-router';

import type { Gate } from './core/limits';

/** Returns true if allowed; otherwise opens the paywall explaining why. */
export function passGate(gate: Gate): boolean {
  if (gate.allowed) return true;
  router.push({ pathname: '/paywall', params: { feature: gate.feature } });
  return false;
}
