import { compareReports } from '../../../benchmark/create-from-json/compare';
import {
  BenchmarkReport,
  MetricResult,
} from '../../../benchmark/create-from-json/types';

describe('createFromJSON benchmark comparisons', () => {
  test('normalizes improvement direction for throughput and delay', () => {
    const baseline = report([
      result('throughput', 100, true),
      result('event-loop-delay', 100, false),
    ]);
    const current = report([
      result('throughput', 120, true),
      result('event-loop-delay', 80, false),
    ]);

    expect(compareReports(baseline, current)).toEqual([
      expect.objectContaining({
        metric: 'throughput',
        percentChange: 20,
        improvementPercent: 20,
      }),
      expect.objectContaining({
        metric: 'event-loop-delay',
        percentChange: -20,
        improvementPercent: 20,
      }),
    ]);
  });
});

function result(
  metric: 'throughput' | 'event-loop-delay',
  value: number,
  higherIsBetter: boolean,
): MetricResult {
  return {
    metric,
    dataset: {
      name: 'real-golang-646',
      kind: 'fixture',
      nodes: 646,
      packages: 646,
      edges: 2688,
    },
    primary: {
      name: metric === 'throughput' ? 'operations-per-second' : 'timer-delay',
      unit: metric === 'throughput' ? 'ops/s' : 'ms',
      value,
      higherIsBetter,
    },
    measurements: {},
  };
}

function report(results: MetricResult[]): BenchmarkReport {
  return {
    schemaVersion: 1,
    benchmark: 'createFromJSON',
    generatedAt: '2026-01-01T00:00:00.000Z',
    runtime: {
      node: 'v20.0.0',
      platform: 'linux',
      arch: 'x64',
      cpuModel: 'test',
      cpuCount: 1,
    },
    configuration: {
      throughputTargetMs: 500,
      eventLoopTargetMs: 250,
      rounds: 5,
    },
    results,
  };
}
