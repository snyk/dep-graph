#!/usr/bin/env -S node -r ts-node/register/transpile-only

import { readFileSync } from 'fs';

import { percentChange, round } from './measurement';
import { BenchmarkReport, MetricComparison, MetricResult } from './types';

export function compareReports(
  baseline: BenchmarkReport,
  current: BenchmarkReport,
): MetricComparison[] {
  return current.results.map((result) => {
    const baselineResult = findMatchingResult(baseline, result);
    const change = percentChange(
      result.primary.value,
      baselineResult.primary.value,
    );

    return {
      metric: result.metric,
      dataset: result.dataset.name,
      primary: result.primary.name,
      unit: result.primary.unit,
      baseline: baselineResult.primary.value,
      current: result.primary.value,
      percentChange: change,
      improvementPercent: round(
        result.primary.higherIsBetter ? change : -change,
      ),
    };
  });
}

function findMatchingResult(
  report: BenchmarkReport,
  result: MetricResult,
): MetricResult {
  const match = report.results.find(
    (candidate) =>
      candidate.metric === result.metric &&
      candidate.dataset.name === result.dataset.name,
  );
  if (!match) {
    throw new Error(
      `baseline is missing ${result.metric}/${result.dataset.name}`,
    );
  }
  if (match.primary.name !== result.primary.name) {
    throw new Error(
      `primary measurement changed for ${result.metric}/${result.dataset.name}`,
    );
  }
  return match;
}

function readReport(path: string | undefined): BenchmarkReport {
  if (!path) throw new Error('baseline and current report paths are required');
  return JSON.parse(readFileSync(path, { encoding: 'utf8' }));
}

if (require.main === module) {
  const baseline = readReport(process.argv[2]);
  const current = readReport(process.argv[3]);
  process.stdout.write(
    `${JSON.stringify(compareReports(baseline, current), null, 2)}\n`,
  );
}
