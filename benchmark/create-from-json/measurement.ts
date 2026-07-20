import { SampleSummary } from './types';

export function calculateIterations(
  sampleDurationMs: number,
  targetDurationMs: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(sampleDurationMs) || sampleDurationMs <= 0) {
    return maximum;
  }
  return Math.max(
    minimum,
    Math.min(maximum, Math.ceil(targetDurationMs / sampleDurationMs)),
  );
}

export function summarizeSamples(samples: number[]): SampleSummary {
  if (samples.length === 0) {
    throw new Error('cannot summarize an empty sample set');
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const mean =
    sorted.reduce((total, sample) => total + sample, 0) / sorted.length;

  return {
    min: sorted[0],
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1],
    mean,
  };
}

export function percentChange(current: number, baseline: number): number {
  if (baseline === 0) {
    throw new Error('cannot calculate percentage change from a zero baseline');
  }
  return round(((current - baseline) / baseline) * 100);
}

export function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentile(sortedSamples: number[], percentileValue: number): number {
  const index = Math.max(
    0,
    Math.ceil(percentileValue * sortedSamples.length) - 1,
  );
  return sortedSamples[index];
}
