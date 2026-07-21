import {
  DEFAULT_GATE_CONFIGURATION,
  evaluateGate,
  oneSidedLowerConfidenceBound,
} from '../../../benchmark/create-from-json/gate';
import {
  BenchmarkCycle,
  BenchmarkReport,
  MetricName,
  MetricResult,
} from '../../../benchmark/create-from-json/types';

describe('createFromJSON performance regression gate', () => {
  test('uses an exact one-sided lower confidence bound', () => {
    expect(
      oneSidedLowerConfidenceBound(
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        0.95,
      ),
    ).toStrictEqual({
      actualConfidence: 0.980713,
      requiredRegressingSamples: 10,
      value: 3,
    });
  });

  test('passes stable paired measurements with small control noise', () => {
    const gate = evaluateGate(
      cycles(() => ({ baselineA: 100, baselineB: 101, candidate: 99 })),
      DEFAULT_GATE_CONFIGURATION,
    );

    expect(gate.status).toBe('pass');
    expect(gate.cells[0]).toEqual(
      expect.objectContaining({
        status: 'pass',
        baselineSamples: 24,
        candidateSamples: 12,
      }),
    );
  });

  test('blocks a high-confidence throughput regression', () => {
    const gate = evaluateGate(
      cycles(() => ({ baselineA: 100, baselineB: 101, candidate: 80 })),
      DEFAULT_GATE_CONFIGURATION,
    );

    expect(gate.status).toBe('regression');
    expect(gate.cells[0]).toEqual(
      expect.objectContaining({
        metric: 'throughput',
        status: 'regression',
      }),
    );
    expect(gate.cells[0].regressionLowerConfidenceBoundPercent).toBeGreaterThan(
      gate.cells[0].allowedRegressionPercent,
    );
  });

  test('normalizes lower-is-better metrics before blocking', () => {
    const gate = evaluateGate(
      cycles(
        () => ({ baselineA: 100, baselineB: 101, candidate: 130 }),
        'event-loop-delay',
        false,
      ),
      DEFAULT_GATE_CONFIGURATION,
    );

    expect(gate.status).toBe('regression');
    expect(gate.cells[0].medianRegressionPercent).toBeGreaterThan(0);
  });

  test('does not block on two outliers among twelve paired cycles', () => {
    const gate = evaluateGate(
      cycles((index) => ({
        baselineA: 100,
        baselineB: 101,
        candidate: index < 2 ? 50 : 100,
      })),
      DEFAULT_GATE_CONFIGURATION,
    );

    expect(gate.status).toBe('pass');
  });

  test('blocks as inconclusive when repeated controls exceed the noise ceiling', () => {
    const gate = evaluateGate(
      cycles(() => ({ baselineA: 100, baselineB: 140, candidate: 100 })),
      DEFAULT_GATE_CONFIGURATION,
    );

    expect(gate.status).toBe('inconclusive');
    expect(gate.cells[0]).toEqual(
      expect.objectContaining({
        status: 'inconclusive',
      }),
    );
  });
});

function cycles(
  values: (index: number) => {
    baselineA: number;
    baselineB: number;
    candidate: number;
  },
  metric: MetricName = 'throughput',
  higherIsBetter = true,
): BenchmarkCycle[] {
  return Array.from({ length: 12 }, (_, index) => {
    const cycleValues = values(index);
    return {
      index,
      order: ['baseline-a', 'baseline-b', 'candidate'],
      reports: {
        'baseline-a': report(metric, cycleValues.baselineA, higherIsBetter),
        'baseline-b': report(metric, cycleValues.baselineB, higherIsBetter),
        candidate: report(metric, cycleValues.candidate, higherIsBetter),
      },
    };
  });
}

function report(
  metric: MetricName,
  value: number,
  higherIsBetter: boolean,
): BenchmarkReport {
  return {
    schemaVersion: 1,
    benchmark: 'createFromJSON',
    generatedAt: '2026-01-01T00:00:00.000Z',
    runtime: {
      node: 'v20.20.2',
      platform: 'linux',
      arch: 'x64',
      cpuModel: 'test',
      cpuCount: 2,
    },
    configuration: {
      throughputTargetMs: 500,
      eventLoopTargetMs: 250,
      rounds: 5,
    },
    results: [result(metric, value, higherIsBetter)],
  };
}

function result(
  metric: MetricName,
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
      name: metric,
      unit: metric === 'memory' ? 'bytes' : 'ms',
      value,
      higherIsBetter,
    },
    measurements: {},
  };
}
