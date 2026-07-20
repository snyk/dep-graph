#!/usr/bin/env -S node -r ts-node/register/transpile-only

import { spawnSync } from 'child_process';
import { cpus } from 'os';
import { join, resolve } from 'path';

import { DATASET_CONFIGS } from './datasets';
import {
  BenchmarkReport,
  DatasetName,
  MetricName,
  MetricResult,
} from './types';

export interface RunnerOptions {
  datasets: DatasetName[];
  metrics: MetricName[];
  throughputTargetMs: number;
  eventLoopTargetMs: number;
  rounds: number;
  implementationPath: string;
}

const ALL_METRICS: MetricName[] = ['throughput', 'event-loop-delay', 'memory'];

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  const results: MetricResult[] = [];

  for (const dataset of options.datasets) {
    for (const metric of options.metrics) {
      results.push(runIsolatedMetric(metric, dataset, options));
    }
  }

  const processors = cpus();
  const report: BenchmarkReport = {
    schemaVersion: 1,
    benchmark: 'createFromJSON',
    generatedAt: new Date().toISOString(),
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuModel: processors[0]?.model || 'unknown',
      cpuCount: processors.length,
    },
    configuration: {
      throughputTargetMs: options.throughputTargetMs,
      eventLoopTargetMs: options.eventLoopTargetMs,
      rounds: options.rounds,
    },
    results,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function runIsolatedMetric(
  metric: MetricName,
  dataset: DatasetName,
  options: RunnerOptions,
): MetricResult {
  const request = JSON.stringify({
    metric,
    dataset,
    throughputTargetMs: options.throughputTargetMs,
    eventLoopTargetMs: options.eventLoopTargetMs,
    rounds: options.rounds,
    implementationPath: options.implementationPath,
  });
  const workerPath = join(__dirname, 'worker.ts');
  const child = spawnSync(
    process.execPath,
    [
      '--expose-gc',
      '-r',
      'ts-node/register/transpile-only',
      workerPath,
      request,
    ],
    {
      cwd: join(__dirname, '..', '..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        TS_NODE_PROJECT: join(__dirname, '..', 'tsconfig.json'),
      },
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (child.status !== 0) {
    throw new Error(
      `isolated ${metric}/${dataset} benchmark failed:\n${child.stderr}`,
    );
  }
  return JSON.parse(child.stdout);
}

export function parseOptions(args: string[]): RunnerOptions {
  const quick = args.includes('--quick');
  const throughputTargetMs = readNumberOption(
    args,
    '--throughput-ms',
    quick ? 50 : 1000,
  );
  const eventLoopTargetMs = readNumberOption(
    args,
    '--event-loop-ms',
    quick ? 50 : 250,
  );
  const rounds = readIntegerOption(args, '--rounds', quick ? 2 : 5);

  const availableDatasets = DATASET_CONFIGS.map(({ name }) => name);

  return {
    datasets: readListOption(
      args,
      '--datasets',
      availableDatasets,
      availableDatasets,
    ),
    metrics: readListOption(args, '--metrics', ALL_METRICS, ALL_METRICS),
    throughputTargetMs,
    eventLoopTargetMs,
    rounds,
    implementationPath: resolve(
      readStringOption(
        args,
        '--implementation',
        join(__dirname, '..', '..', 'src', 'index.ts'),
      ),
    ),
  };
}

function readStringOption(
  args: string[],
  name: string,
  defaultValue: string,
): string {
  const index = args.indexOf(name);
  if (index === -1) return defaultValue;
  const value = args[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function readIntegerOption(
  args: string[],
  name: string,
  defaultValue: number,
): number {
  const value = readNumberOption(args, name, defaultValue);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function readNumberOption(
  args: string[],
  name: string,
  defaultValue: number,
): number {
  const index = args.indexOf(name);
  if (index === -1) return defaultValue;
  const value = Number(args[index + 1]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

function readListOption<T extends string>(
  args: string[],
  name: string,
  defaultValue: T[],
  allowedValues: T[],
): T[] {
  const index = args.indexOf(name);
  if (index === -1) return defaultValue;
  const value = args[index + 1];
  if (!value) throw new Error(`${name} requires a comma-separated value`);
  return value.split(',').map((entry) => {
    if (!allowedValues.includes(entry as T)) {
      throw new Error(`${name} contains unknown value: ${entry}`);
    }
    return entry as T;
  });
}

if (require.main === module) {
  main();
}
