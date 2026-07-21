import {
  calculateIterations,
  percentChange,
  round,
  summarizeSamples,
} from '../../../benchmark/create-from-json/measurement';
import { createDataset } from '../../../benchmark/create-from-json/datasets';
import { measureEventLoopDelay } from '../../../benchmark/create-from-json/metrics/event-loop-delay';
import { measureThroughput } from '../../../benchmark/create-from-json/metrics/throughput';
import { parseOptions } from '../../../benchmark/create-from-json/run';
import { createFromJSON } from '../../../src';
import { resolve } from 'path';

describe('createFromJSON benchmark measurement utilities', () => {
  test('calibrates iterations within explicit bounds', () => {
    expect(calculateIterations(10, 1000, 2, 500)).toBe(100);
    expect(calculateIterations(0.01, 1000, 2, 500)).toBe(500);
    expect(calculateIterations(1000, 100, 2, 500)).toBe(2);
  });

  test('summarizes samples using deterministic percentiles', () => {
    expect(summarizeSamples([5, 1, 4, 2, 3])).toStrictEqual({
      min: 1,
      median: 3,
      p95: 5,
      max: 5,
      mean: 3,
    });
  });

  test('reports signed percentage changes', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
  });

  test('rejects unknown metric names', () => {
    expect(() => parseOptions(['--metrics', 'throughputt'])).toThrow(
      /unknown value/,
    );
  });

  test('rejects fractional round counts', () => {
    expect(() => parseOptions(['--rounds', '1.5'])).toThrow(/positive integer/);
  });

  test('accepts an implementation module outside the harness worktree', () => {
    expect(
      parseOptions(['--implementation', '/tmp/base/src/index.ts'])
        .implementationPath,
    ).toBe('/tmp/base/src/index.ts');
  });

  test('resolves relative implementation modules before spawning workers', () => {
    expect(
      parseOptions(['--implementation', 'src/index.ts']).implementationPath,
    ).toBe(resolve('src/index.ts'));
  });

  test('uses median synchronous duration as the event-loop gate signal', async () => {
    const result = await measureEventLoopDelay(
      createDataset('real-golang-646'),
      1,
      3,
      createFromJSON,
    );

    const blockSummary = result.measurements.singleCallBlockMs;
    if (typeof blockSummary === 'number') {
      throw new Error('single-call block measurement must be a sample summary');
    }
    expect(result.primary.name).toBe('single-call-block-median');
    expect(result.primary.value).toBe(round(blockSummary.median));
  });

  test('uses one-second throughput rounds outside quick mode', () => {
    expect(parseOptions([]).throughputTargetMs).toBe(1000);
    expect(parseOptions(['--quick']).throughputTargetMs).toBe(50);
  });

  test('uses process CPU time as the throughput gate signal', () => {
    const result = measureThroughput(
      createDataset('real-golang-646'),
      50,
      3,
      createFromJSON,
    );

    const cpuSummary = result.measurements.cpuOperationMs;
    if (typeof cpuSummary === 'number') {
      throw new Error('CPU operation measurement must be a sample summary');
    }
    expect(result.primary.name).toBe('cpu-operations-per-second');
    expect(result.primary.value).toBe(round(1000 / cpuSummary.median));
    expect(result.measurements.warmupIterations).toEqual(expect.any(Number));
    expect(result.measurements.warmupIterations).toBeGreaterThanOrEqual(10);
    expect(result.measurements.warmupCpuDurationMs).toBeGreaterThanOrEqual(500);
    expect(result.measurements.warmupWallDurationMs).toEqual(
      expect.any(Number),
    );
  });
});
