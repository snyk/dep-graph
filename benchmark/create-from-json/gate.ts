import {
  BenchmarkCycle,
  BenchmarkReport,
  GateConfiguration,
  GateStatus,
  MetricGateResult,
  MetricResult,
  PerformanceGateReport,
} from './types';
import { round, summarizeSamples } from './measurement';

export const DEFAULT_GATE_CONFIGURATION: GateConfiguration = {
  confidence: 0.95,
  minimumCycles: 12,
  controlNoiseMultiplier: 1,
  metrics: {
    throughput: {
      minimumRegressionPercent: 5,
      maximumControlNoisePercent: 10,
    },
    'event-loop-delay': {
      minimumRegressionPercent: 10,
      maximumControlNoisePercent: 20,
    },
    memory: {
      minimumRegressionPercent: 5,
      maximumControlNoisePercent: 10,
    },
  },
};

export function evaluateGate(
  cycles: BenchmarkCycle[],
  configuration: GateConfiguration,
): PerformanceGateReport {
  if (cycles.length < configuration.minimumCycles) {
    throw new Error(
      `performance gate requires at least ${configuration.minimumCycles} cycles`,
    );
  }

  const referenceResults = cycles[0].reports['baseline-a'].results;
  const cells = referenceResults.map((reference) =>
    evaluateCell(cycles, reference, configuration),
  );

  return {
    schemaVersion: 1,
    benchmark: 'createFromJSON',
    status: overallStatus(cells),
    configuration,
    cells,
  };
}

export function oneSidedLowerConfidenceBound(
  samples: number[],
  confidence: number,
): {
  value: number;
  actualConfidence: number;
  requiredRegressingSamples: number;
} {
  if (samples.length === 0) {
    throw new Error('confidence bound requires at least one sample');
  }
  if (confidence <= 0.5 || confidence >= 1) {
    throw new Error('confidence must be greater than 0.5 and less than 1');
  }

  const requiredRegressingSamples = requiredSuccesses(
    samples.length,
    1 - confidence,
  );
  const sorted = [...samples].sort((left, right) => left - right);
  const value = sorted[samples.length - requiredRegressingSamples];
  const falsePositiveProbability = binomialUpperTail(
    samples.length,
    requiredRegressingSamples,
  );

  return {
    value: round(value),
    actualConfidence: round(1 - falsePositiveProbability),
    requiredRegressingSamples,
  };
}

function evaluateCell(
  cycles: BenchmarkCycle[],
  reference: MetricResult,
  configuration: GateConfiguration,
): MetricGateResult {
  const baselineValues: number[] = [];
  const candidateValues: number[] = [];
  const regressionSamples: number[] = [];
  const controlNoiseSamples: number[] = [];

  for (const cycle of cycles) {
    const baselineA = matchingResult(cycle.reports['baseline-a'], reference);
    const baselineB = matchingResult(cycle.reports['baseline-b'], reference);
    const candidate = matchingResult(cycle.reports.candidate, reference);
    assertComparable(reference, baselineA);
    assertComparable(reference, baselineB);
    assertComparable(reference, candidate);

    const baselineAValue = positiveValue(baselineA);
    const baselineBValue = positiveValue(baselineB);
    const candidateValue = positiveValue(candidate);
    const pairedBaseline = Math.sqrt(baselineAValue * baselineBValue);

    baselineValues.push(baselineAValue, baselineBValue);
    candidateValues.push(candidateValue);
    regressionSamples.push(
      regressionPercent(
        candidateValue,
        pairedBaseline,
        reference.primary.higherIsBetter,
      ),
    );
    controlNoiseSamples.push(
      symmetricPercentDifference(baselineAValue, baselineBValue),
    );
  }

  const metricConfiguration = configuration.metrics[reference.metric];
  const controlNoiseP75Percent = percentile(controlNoiseSamples, 0.75);
  const allowedRegressionPercent = Math.max(
    metricConfiguration.minimumRegressionPercent,
    controlNoiseP75Percent * configuration.controlNoiseMultiplier,
  );
  const lowerBound = oneSidedLowerConfidenceBound(
    regressionSamples,
    configuration.confidence,
  );

  let status: GateStatus = 'pass';
  if (controlNoiseP75Percent > metricConfiguration.maximumControlNoisePercent) {
    status = 'inconclusive';
  } else if (lowerBound.value > allowedRegressionPercent) {
    status = 'regression';
  }

  return {
    metric: reference.metric,
    dataset: reference.dataset.name,
    primary: reference.primary.name,
    unit: reference.primary.unit,
    status,
    baselineSamples: baselineValues.length,
    candidateSamples: candidateValues.length,
    baselineMedian: round(summarizeSamples(baselineValues).median),
    candidateMedian: round(summarizeSamples(candidateValues).median),
    medianRegressionPercent: round(summarizeSamples(regressionSamples).median),
    regressionLowerConfidenceBoundPercent: lowerBound.value,
    confidence: lowerBound.actualConfidence,
    requiredRegressingSamples: lowerBound.requiredRegressingSamples,
    controlNoiseP75Percent: round(controlNoiseP75Percent),
    allowedRegressionPercent: round(allowedRegressionPercent),
    maximumControlNoisePercent: metricConfiguration.maximumControlNoisePercent,
  };
}

function matchingResult(
  report: BenchmarkReport,
  reference: MetricResult,
): MetricResult {
  const result = report.results.find(
    (candidate) =>
      candidate.metric === reference.metric &&
      candidate.dataset.name === reference.dataset.name,
  );
  if (!result) {
    throw new Error(
      `report is missing ${reference.metric}/${reference.dataset.name}`,
    );
  }
  return result;
}

function assertComparable(reference: MetricResult, result: MetricResult): void {
  if (
    result.primary.name !== reference.primary.name ||
    result.primary.unit !== reference.primary.unit ||
    result.primary.higherIsBetter !== reference.primary.higherIsBetter
  ) {
    throw new Error(
      `primary measurement changed for ${reference.metric}/${reference.dataset.name}`,
    );
  }
}

function positiveValue(result: MetricResult): number {
  if (!Number.isFinite(result.primary.value) || result.primary.value <= 0) {
    throw new Error(
      `${result.metric}/${result.dataset.name} must report a positive finite value`,
    );
  }
  return result.primary.value;
}

function regressionPercent(
  candidate: number,
  baseline: number,
  higherIsBetter: boolean,
): number {
  const change = ((candidate - baseline) / baseline) * 100;
  return higherIsBetter ? -change : change;
}

function symmetricPercentDifference(left: number, right: number): number {
  return (200 * Math.abs(left - right)) / (left + right);
}

function percentile(samples: number[], value: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(value * sorted.length) - 1)];
}

function overallStatus(cells: MetricGateResult[]): GateStatus {
  if (cells.some(({ status }) => status === 'regression')) return 'regression';
  if (cells.some(({ status }) => status === 'inconclusive')) {
    return 'inconclusive';
  }
  return 'pass';
}

function requiredSuccesses(sampleCount: number, alpha: number): number {
  for (
    let successes = Math.floor(sampleCount / 2) + 1;
    successes <= sampleCount;
    successes += 1
  ) {
    if (binomialUpperTail(sampleCount, successes) <= alpha) {
      return successes;
    }
  }
  return sampleCount;
}

function binomialUpperTail(sampleCount: number, successes: number): number {
  let combinations = 0;
  for (let index = successes; index <= sampleCount; index += 1) {
    combinations += binomialCoefficient(sampleCount, index);
  }
  return combinations / 2 ** sampleCount;
}

function binomialCoefficient(total: number, selected: number): number {
  const count = Math.min(selected, total - selected);
  let result = 1;
  for (let index = 1; index <= count; index += 1) {
    result = (result * (total - count + index)) / index;
  }
  return result;
}
