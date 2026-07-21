import { DepGraph } from '../../../src';
import { datasetConfiguration, memoryRetainedGraphCount } from '../datasets';
import { round } from '../measurement';
import { BenchmarkDataset, CreateFromJSON, MetricResult } from '../types';

export function measureMemory(
  dataset: BenchmarkDataset,
  createFromJSON: CreateFromJSON,
): MetricResult {
  if (!global.gc) {
    throw new Error('memory benchmark requires Node.js --expose-gc');
  }

  for (let index = 0; index < 3; index += 1) {
    createFromJSON(dataset.data);
  }

  const retainedGraphs = memoryRetainedGraphCount(dataset.name);

  createFromJSON(dataset.data);
  global.gc();
  const before = process.memoryUsage();
  const { peakHeapUsed, peakRss, retained } = retainGraphs(
    dataset,
    retainedGraphs,
    before,
    createFromJSON,
  );
  global.gc();
  const released = process.memoryUsage();

  return {
    metric: 'memory',
    dataset: datasetConfiguration(dataset),
    primary: {
      name: 'retained-heap-bytes-per-graph',
      unit: 'bytes',
      value: round((retained.heapUsed - before.heapUsed) / retainedGraphs),
      higherIsBetter: false,
    },
    measurements: {
      retainedGraphs,
      baselineHeapUsedBytes: before.heapUsed,
      peakHeapDeltaBytes: peakHeapUsed - before.heapUsed,
      peakRssDeltaBytes: peakRss - before.rss,
      retainedHeapDeltaBytes: retained.heapUsed - before.heapUsed,
      releasedHeapDeltaBytes: released.heapUsed - before.heapUsed,
    },
  };
}

function retainGraphs(
  dataset: BenchmarkDataset,
  count: number,
  baseline: NodeJS.MemoryUsage,
  createFromJSON: CreateFromJSON,
): {
  peakHeapUsed: number;
  peakRss: number;
  retained: NodeJS.MemoryUsage;
} {
  const graphs: DepGraph[] = [];
  let peakHeapUsed = baseline.heapUsed;
  let peakRss = baseline.rss;

  for (let iteration = 0; iteration < count; iteration += 1) {
    graphs.push(createFromJSON(dataset.data));
    const current = process.memoryUsage();
    peakHeapUsed = Math.max(peakHeapUsed, current.heapUsed);
    peakRss = Math.max(peakRss, current.rss);
  }

  global.gc?.();
  return { peakHeapUsed, peakRss, retained: process.memoryUsage() };
}
