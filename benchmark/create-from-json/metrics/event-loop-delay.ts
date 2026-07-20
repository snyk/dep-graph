import { monitorEventLoopDelay, performance } from 'perf_hooks';

import { datasetConfiguration } from '../datasets';
import { calculateIterations, round, summarizeSamples } from '../measurement';
import { BenchmarkDataset, CreateFromJSON, MetricResult } from '../types';

const HISTOGRAM_RESOLUTION_MS = 10;

export async function measureEventLoopDelay(
  dataset: BenchmarkDataset,
  targetDurationMs: number,
  rounds: number,
  createFromJSON: CreateFromJSON,
): Promise<MetricResult> {
  for (let index = 0; index < 3; index += 1) {
    createFromJSON(dataset.data);
  }

  const calibrationSamples: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    const sampleStartedAt = performance.now();
    createFromJSON(dataset.data);
    calibrationSamples.push(performance.now() - sampleStartedAt);
  }
  const sampleDurationMs = summarizeSamples(calibrationSamples).median;
  const iterations = calculateIterations(
    sampleDurationMs,
    targetDurationMs,
    1,
    100,
  );

  const singleCallBlockSamples: number[] = [];
  const singleCallTimerDelaySamples: number[] = [];
  const saturatedBlockSamples: number[] = [];
  const saturatedTimerDelaySamples: number[] = [];
  const monitorP99Samples: number[] = [];
  const monitorMaxSamples: number[] = [];

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    const histogram = monitorEventLoopDelay({
      resolution: HISTOGRAM_RESOLUTION_MS,
    });
    histogram.enable();
    await delay(HISTOGRAM_RESOLUTION_MS * 2);

    const singleCallTimerScheduledAt = performance.now();
    const singleCallTimerDelay = new Promise<number>((resolve) => {
      setTimeout(
        () => resolve(performance.now() - singleCallTimerScheduledAt),
        0,
      );
    });
    const singleCallStartedAt = performance.now();
    createFromJSON(dataset.data);
    singleCallBlockSamples.push(performance.now() - singleCallStartedAt);
    singleCallTimerDelaySamples.push(await singleCallTimerDelay);

    const saturatedTimerScheduledAt = performance.now();
    const saturatedTimerDelay = new Promise<number>((resolve) => {
      setTimeout(
        () => resolve(performance.now() - saturatedTimerScheduledAt),
        0,
      );
    });
    const saturatedBlockStartedAt = performance.now();
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      createFromJSON(dataset.data);
    }
    saturatedBlockSamples.push(performance.now() - saturatedBlockStartedAt);
    saturatedTimerDelaySamples.push(await saturatedTimerDelay);

    await delay(HISTOGRAM_RESOLUTION_MS * 2);
    histogram.disable();
    monitorP99Samples.push(nanosecondsToMilliseconds(histogram.percentile(99)));
    monitorMaxSamples.push(nanosecondsToMilliseconds(histogram.max));
  }

  const singleCallBlockMs = summarizeSamples(singleCallBlockSamples);
  const singleCallTimerDelayMs = summarizeSamples(singleCallTimerDelaySamples);

  return {
    metric: 'event-loop-delay',
    dataset: datasetConfiguration(dataset),
    primary: {
      name: 'single-call-block-median',
      unit: 'ms',
      value: round(singleCallBlockMs.median),
      higherIsBetter: false,
    },
    measurements: {
      iterationsPerSaturatedBlock: iterations,
      rounds,
      singleCallBlockMs,
      singleCallTimerDelayMs,
      saturatedBlockMs: summarizeSamples(saturatedBlockSamples),
      saturatedTimerDelayMs: summarizeSamples(saturatedTimerDelaySamples),
      monitorP99Ms: summarizeSamples(monitorP99Samples),
      monitorMaxMs: summarizeSamples(monitorMaxSamples),
    },
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function nanosecondsToMilliseconds(nanoseconds: number): number {
  return round(nanoseconds / 1_000_000);
}
