import { DepGraph, DepGraphData } from '../../src';

export type CreateFromJSON = (data: DepGraphData) => DepGraph;

export type DatasetName =
  | 'real-golang-646'
  | 'synthetic-5000'
  | 'synthetic-20000';

export type MetricName = 'throughput' | 'event-loop-delay' | 'memory';

export type BenchmarkVariant = 'baseline-a' | 'baseline-b' | 'candidate';

export interface DatasetConfiguration {
  name: DatasetName;
  kind: 'fixture' | 'synthetic';
  nodes: number;
  packages: number;
  edges: number;
}

export interface BenchmarkDataset extends DatasetConfiguration {
  data: DepGraphData;
}

export interface SampleSummary {
  min: number;
  median: number;
  p95: number;
  max: number;
  mean: number;
}

export interface MetricResult {
  metric: MetricName;
  dataset: DatasetConfiguration;
  primary: {
    name: string;
    unit: string;
    value: number;
    higherIsBetter: boolean;
  };
  measurements: Record<string, number | SampleSummary>;
}

export interface BenchmarkReport {
  schemaVersion: 1;
  benchmark: 'createFromJSON';
  generatedAt: string;
  runtime: {
    node: string;
    platform: NodeJS.Platform;
    arch: string;
    cpuModel: string;
    cpuCount: number;
  };
  configuration: {
    throughputTargetMs: number;
    eventLoopTargetMs: number;
    rounds: number;
  };
  results: MetricResult[];
}

export interface MetricComparison {
  metric: MetricName;
  dataset: DatasetName;
  primary: string;
  unit: string;
  baseline: number;
  current: number;
  percentChange: number;
  improvementPercent: number;
}

export interface BenchmarkCycle {
  index: number;
  order: BenchmarkVariant[];
  reports: Record<BenchmarkVariant, BenchmarkReport>;
}

export interface MetricGateConfiguration {
  minimumRegressionPercent: number;
  maximumControlNoisePercent: number;
}

export interface GateConfiguration {
  confidence: number;
  minimumCycles: number;
  controlNoiseMultiplier: number;
  metrics: Record<MetricName, MetricGateConfiguration>;
}

export type GateStatus = 'pass' | 'regression' | 'inconclusive';

export interface MetricGateResult {
  metric: MetricName;
  dataset: DatasetName;
  primary: string;
  unit: string;
  status: GateStatus;
  baselineSamples: number;
  candidateSamples: number;
  baselineMedian: number;
  candidateMedian: number;
  medianRegressionPercent: number;
  regressionLowerConfidenceBoundPercent: number;
  confidence: number;
  requiredRegressingSamples: number;
  controlNoiseP75Percent: number;
  allowedRegressionPercent: number;
  maximumControlNoisePercent: number;
}

export interface PerformanceGateReport {
  schemaVersion: 1;
  benchmark: 'createFromJSON';
  status: GateStatus;
  configuration: GateConfiguration;
  cells: MetricGateResult[];
}
