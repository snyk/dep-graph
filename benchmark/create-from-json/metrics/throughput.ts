import { performance } from 'perf_hooks';

import { datasetConfiguration } from '../datasets';
import { calculateIterations, round, summarizeSamples } from '../measurement';
import { BenchmarkDataset, CreateFromJSON, MetricResult } from '../types';

const WARMUP_TARGET_MS = 500;
const MINIMUM_WARMUP_ITERATIONS = 10;

export function measureThroughput(
  dataset: BenchmarkDataset,
  targetDurationMs: number,
  rounds: number,
  createFromJSON: CreateFromJSON,
): MetricResult {
  for (let index = 0; index < 3; index += 1) {
    createFromJSON(dataset.data);
  }

  const warmup = warmUp(dataset, createFromJSON);
  const sampleDurationMs = sampleDuration(dataset, createFromJSON);
  const iterations = calculateIterations(
    sampleDurationMs,
    targetDurationMs,
    1,
    500,
  );

  const operationSamples: number[] = [];
  const cpuOperationSamples: number[] = [];
  for (let round = 0; round < rounds; round += 1) {
    const cpuStartedAt = process.cpuUsage();
    const startedAt = performance.now();
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      createFromJSON(dataset.data);
    }
    operationSamples.push((performance.now() - startedAt) / iterations);
    const cpuDuration = process.cpuUsage(cpuStartedAt);
    cpuOperationSamples.push(
      (cpuDuration.user + cpuDuration.system) / 1000 / iterations,
    );
  }

  const operationMs = summarizeSamples(operationSamples);
  const cpuOperationMs = summarizeSamples(cpuOperationSamples);
  const operationsPerSecond = round(1000 / cpuOperationMs.median);

  return {
    metric: 'throughput',
    dataset: datasetConfiguration(dataset),
    primary: {
      name: 'cpu-operations-per-second',
      unit: 'ops/s',
      value: operationsPerSecond,
      higherIsBetter: true,
    },
    measurements: {
      iterationsPerRound: iterations,
      warmupIterations: warmup.iterations,
      warmupCpuDurationMs: round(warmup.cpuDurationMs),
      warmupWallDurationMs: round(warmup.wallDurationMs),
      rounds,
      operationMs,
      cpuOperationMs,
    },
  };
}

function warmUp(
  dataset: BenchmarkDataset,
  createFromJSON: CreateFromJSON,
): { iterations: number; cpuDurationMs: number; wallDurationMs: number } {
  const cpuStartedAt = process.cpuUsage();
  const startedAt = performance.now();
  let iterations = 0;
  let cpuDurationMs = 0;
  do {
    createFromJSON(dataset.data);
    iterations += 1;
    const cpuDuration = process.cpuUsage(cpuStartedAt);
    cpuDurationMs = (cpuDuration.user + cpuDuration.system) / 1000;
  } while (
    cpuDurationMs < WARMUP_TARGET_MS ||
    iterations < MINIMUM_WARMUP_ITERATIONS
  );
  return {
    iterations,
    cpuDurationMs,
    wallDurationMs: performance.now() - startedAt,
  };
}

function sampleDuration(
  dataset: BenchmarkDataset,
  createFromJSON: CreateFromJSON,
): number {
  const samples: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    const startedAt = performance.now();
    createFromJSON(dataset.data);
    samples.push(performance.now() - startedAt);
  }
  return summarizeSamples(samples).median;
}
