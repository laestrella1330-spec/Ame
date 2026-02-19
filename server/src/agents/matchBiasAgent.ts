/**
 * MatchBias Agent
 *
 * Calculates additional compatibility score based on energy_level and intent.
 * Integrated into Matchmaker.compatibilityScore().
 *
 * Rules:
 * - Never blocks a match — only adjusts weights
 * - Compatible energy/intent adds +2 per dimension
 * - Opposite extremes (chill ↔ hype) subtracts -1
 * - Missing preferences are neutral (0)
 */

export type EnergyLevel = 'chill' | 'normal' | 'hype';
export type Intent = 'talk' | 'play' | 'flirt' | 'learn';

interface BiasEntry {
  energyLevel?: EnergyLevel;
  intent?: Intent;
}

const ENERGY_MATRIX: Record<EnergyLevel, Record<EnergyLevel, number>> = {
  chill:  { chill: 2, normal: 1, hype: -1 },
  normal: { chill: 1, normal: 2, hype:  1 },
  hype:   { chill: -1, normal: 1, hype: 2 },
};

export function matchBiasScore(a: BiasEntry, b: BiasEntry): number {
  let score = 0;

  // Energy compatibility
  if (a.energyLevel && b.energyLevel) {
    score += ENERGY_MATRIX[a.energyLevel][b.energyLevel];
  }

  // Intent compatibility — exact match = +2, any mismatch = 0
  if (a.intent && b.intent) {
    score += a.intent === b.intent ? 2 : 0;
  }

  return score;
}
