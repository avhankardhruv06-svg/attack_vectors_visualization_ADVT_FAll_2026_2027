// Confidence computation & edge weighting utilities

const EPSILON = 0.0001;

/**
 * Validates and clamps a confidence value between [0.0, 1.0]
 */
export function clampConfidence(confidence: number): number {
  if (isNaN(confidence)) return 0.5;
  return Math.max(0.0, Math.min(1.0, confidence));
}

/**
 * Converts confidence (0..1) to edge weight for shortest-path routing.
 * Higher confidence results in lower edge weight.
 * w = (1 - confidence) + epsilon
 */
export function confidenceToWeight(confidence: number): number {
  const c = clampConfidence(confidence);
  return (1.0 - c) + EPSILON;
}

/**
 * Calculates aggregate path confidence.
 * Uses geometric mean of edge confidences so longer paths with consistently high confidence
 * are appropriately rewarded and single low-confidence links penalized.
 */
export function calculatePathConfidence(edgeConfidences: number[]): number {
  if (edgeConfidences.length === 0) return 1.0;
  
  // Product of confidences with safety floor
  const product = edgeConfidences.reduce((acc, c) => acc * Math.max(0.01, clampConfidence(c)), 1.0);
  // Geometric mean: product^(1 / n)
  const geomMean = Math.pow(product, 1.0 / edgeConfidences.length);
  
  // Harmonic penalty based on hop count
  const hopPenalty = Math.pow(0.98, edgeConfidences.length - 1);
  return parseFloat((geomMean * hopPenalty).toFixed(4));
}

/**
 * Computes human-readable confidence tier
 */
export function getConfidenceTier(confidence: number): {
  label: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SPECULATIVE';
  color: string;
  description: string;
} {
  const c = clampConfidence(confidence);
  if (c >= 0.85) {
    return {
      label: 'VERY_HIGH',
      color: '#10b981', // emerald-500
      description: 'Directly observed forensic evidence (e.g. EDR execution log, auth ticket)',
    };
  } else if (c >= 0.70) {
    return {
      label: 'HIGH',
      color: '#06b6d4', // cyan-500
      description: 'Strong correlation with matching timestamps and process hierarchy',
    };
  } else if (c >= 0.50) {
    return {
      label: 'MEDIUM',
      color: '#f59e0b', // amber-500
      description: 'Probable relationship inferred from network telemetry or temporal proximity',
    };
  } else if (c >= 0.30) {
    return {
      label: 'LOW',
      color: '#f97316', // orange-500
      description: 'Loose correlation; potential concurrent benign activity',
    };
  } else {
    return {
      label: 'SPECULATIVE',
      color: '#ef4444', // red-500
      description: 'Hypothesized pivot link with sparse forensic trace',
    };
  }
}
