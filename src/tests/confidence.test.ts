// Confidence & Weighting Unit Tests
import { describe, it, expect } from 'vitest';
import {
  clampConfidence,
  confidenceToWeight,
  calculatePathConfidence,
  getConfidenceTier,
} from '../graph/confidence';

describe('Confidence and Weighting Math', () => {
  it('should clamp confidence within [0, 1]', () => {
    expect(clampConfidence(1.5)).toBe(1.0);
    expect(clampConfidence(-0.2)).toBe(0.0);
    expect(clampConfidence(0.75)).toBe(0.75);
    expect(clampConfidence(NaN)).toBe(0.5);
  });

  it('should invert confidence to edge weight (higher confidence = lower weight)', () => {
    const highConfWeight = confidenceToWeight(0.95);
    const lowConfWeight = confidenceToWeight(0.20);
    expect(highConfWeight).toBeLessThan(lowConfWeight);
    expect(highConfWeight).toBeCloseTo(0.0501, 3);
    expect(lowConfWeight).toBeCloseTo(0.8001, 3);
  });

  it('should calculate aggregate path confidence using geometric mean and hop penalty', () => {
    const confidences = [0.95, 0.90, 0.88];
    const pathConf = calculatePathConfidence(confidences);
    expect(pathConf).toBeGreaterThan(0.8);
    expect(pathConf).toBeLessThanOrEqual(1.0);

    // Empty path returns 1.0
    expect(calculatePathConfidence([])).toBe(1.0);
  });

  it('should correctly assign confidence tiers', () => {
    expect(getConfidenceTier(0.92).label).toBe('VERY_HIGH');
    expect(getConfidenceTier(0.75).label).toBe('HIGH');
    expect(getConfidenceTier(0.55).label).toBe('MEDIUM');
    expect(getConfidenceTier(0.35).label).toBe('LOW');
    expect(getConfidenceTier(0.15).label).toBe('SPECULATIVE');
  });
});
