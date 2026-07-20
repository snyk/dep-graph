#!/usr/bin/env -S node -r ts-node/register/transpile-only

import { execFileSync, spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { isAbsolute, join, resolve } from 'path';

import { DEFAULT_GATE_CONFIGURATION, evaluateGate } from './gate';
import {
  BenchmarkCycle,
  BenchmarkReport,
  BenchmarkVariant,
  PerformanceGateReport,
} from './types';

export interface CiOptions {
  baseRevision?: string;
  cycles: number;
  outputDirectory: string;
  quick: boolean;
}

const MINIMUM_CYCLES = DEFAULT_GATE_CONFIGURATION.minimumCycles;
const VARIANT_PERMUTATIONS: BenchmarkVariant[][] = [
  ['baseline-a', 'baseline-b', 'candidate'],
  ['baseline-b', 'candidate', 'baseline-a'],
  ['candidate', 'baseline-a', 'baseline-b'],
  ['baseline-a', 'candidate', 'baseline-b'],
  ['candidate', 'baseline-b', 'baseline-a'],
  ['baseline-b', 'baseline-a', 'candidate'],
];

type GitCommand = (repositoryRoot: string, args: string[]) => string;
type CommandExecutor = (
  executable: string,
  args: string[],
  options: { cwd: string; stdio: 'inherit' },
) => unknown;

function main(): void {
  assertNode20();
  const options = parseCiOptions(process.argv.slice(2));
  const repositoryRoot = resolve(__dirname, '..', '..');
  const outputDirectory = isAbsolute(options.outputDirectory)
    ? options.outputDirectory
    : resolve(repositoryRoot, options.outputDirectory);
  mkdirSync(outputDirectory, { recursive: true });

  const baseRevision = resolveBaseRevision(
    repositoryRoot,
    options.baseRevision,
    process.env.CIRCLE_PULL_REQUEST,
  );
  const headRevision = git(repositoryRoot, ['rev-parse', 'HEAD']);
  const baseWorktree = mkdtempSync(
    join(tmpdir(), 'dep-graph-create-from-json-base-'),
  );

  writeJson(join(outputDirectory, 'metadata.json'), {
    schemaVersion: 1,
    node: process.version,
    baseRevision,
    headRevision,
    cycles: options.cycles,
    orders: balancedVariantOrders(options.cycles),
  });

  let worktreeAdded = false;
  try {
    git(repositoryRoot, [
      'worktree',
      'add',
      '--force',
      '--detach',
      baseWorktree,
      baseRevision,
    ]);
    worktreeAdded = true;
    installRevisionDependencies(baseWorktree);
    const cycles = collectCycles(
      repositoryRoot,
      baseWorktree,
      outputDirectory,
      options,
    );
    const gate = evaluateGate(cycles, DEFAULT_GATE_CONFIGURATION);
    writeJson(join(outputDirectory, 'comparison.json'), gate);
    const report = renderReport(gate, baseRevision, headRevision);
    writeFileSync(join(outputDirectory, 'report.md'), report);
    process.stdout.write(report);
    if (gate.status !== 'pass') process.exitCode = 1;
  } finally {
    try {
      if (worktreeAdded) {
        git(repositoryRoot, ['worktree', 'remove', '--force', baseWorktree]);
      }
    } finally {
      rmSync(baseWorktree, { recursive: true, force: true });
    }
  }
}

export function balancedVariantOrders(cycles: number): BenchmarkVariant[][] {
  return Array.from({ length: cycles }, (_, index) => [
    ...VARIANT_PERMUTATIONS[index % VARIANT_PERMUTATIONS.length],
  ]);
}

export function parseCiOptions(args: string[]): CiOptions {
  const cycles = readIntegerOption(args, '--cycles', MINIMUM_CYCLES);
  if (cycles < MINIMUM_CYCLES) {
    throw new Error(`--cycles must be at least ${MINIMUM_CYCLES}`);
  }

  return {
    baseRevision: readOptionalStringOption(args, '--base'),
    cycles,
    outputDirectory: readStringOption(
      args,
      '--output',
      'benchmark/results/create-from-json-ci',
    ),
    quick: args.includes('--quick'),
  };
}

export function resolveBaseRevision(
  repositoryRoot: string,
  requestedRevision: string | undefined,
  circlePullRequest: string | undefined,
  runGit: GitCommand = git,
  isCircleCi: boolean = process.env.CIRCLECI === 'true',
): string {
  if (requestedRevision) {
    return runGit(repositoryRoot, [
      'rev-parse',
      `${requestedRevision}^{commit}`,
    ]);
  }
  if (!circlePullRequest) {
    if (isCircleCi) {
      throw new Error(
        'CircleCI requires CIRCLE_PULL_REQUEST or an explicit --base revision',
      );
    }
    return runGit(repositoryRoot, ['rev-parse', 'HEAD^']);
  }

  const match = circlePullRequest.match(/\/pull\/(\d+)\/?$/);
  if (!match) {
    throw new Error(`invalid CIRCLE_PULL_REQUEST: ${circlePullRequest}`);
  }
  runGit(repositoryRoot, [
    'fetch',
    '--no-tags',
    'origin',
    `refs/pull/${match[1]}/merge`,
  ]);
  return runGit(repositoryRoot, ['merge-base', 'HEAD', 'FETCH_HEAD^1']);
}

export function installRevisionDependencies(
  revisionRoot: string,
  execute: CommandExecutor = execFileSync,
): void {
  execute('npm', ['install'], { cwd: revisionRoot, stdio: 'inherit' });
}

export function benchmarkEnvironment(
  repositoryRoot: string,
  ambientEnvironment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment = { ...ambientEnvironment };
  delete environment.NODE_PATH;
  return {
    ...environment,
    TS_NODE_PROJECT: join(repositoryRoot, 'benchmark', 'tsconfig.json'),
  };
}

function collectCycles(
  repositoryRoot: string,
  baseWorktree: string,
  outputDirectory: string,
  options: CiOptions,
): BenchmarkCycle[] {
  const orders = balancedVariantOrders(options.cycles);
  const implementations: Record<BenchmarkVariant, string> = {
    'baseline-a': join(baseWorktree, 'src', 'index.ts'),
    'baseline-b': join(baseWorktree, 'src', 'index.ts'),
    candidate: join(repositoryRoot, 'src', 'index.ts'),
  };

  return orders.map((order, index) => {
    const cycleDirectory = join(
      outputDirectory,
      `cycle-${String(index + 1).padStart(2, '0')}`,
    );
    mkdirSync(cycleDirectory, { recursive: true });
    const reports = {} as Record<BenchmarkVariant, BenchmarkReport>;

    for (const variant of order) {
      process.stderr.write(
        `cycle ${index + 1}/${options.cycles}: ${variant}\n`,
      );
      reports[variant] = runReport(
        repositoryRoot,
        implementations[variant],
        options.quick,
      );
      writeJson(join(cycleDirectory, `${variant}.json`), reports[variant]);
    }

    return { index, order, reports };
  });
}

function runReport(
  repositoryRoot: string,
  implementationPath: string,
  quick: boolean,
): BenchmarkReport {
  const runnerPath = join(
    repositoryRoot,
    'benchmark',
    'create-from-json',
    'run.ts',
  );
  const args = [
    '-r',
    'ts-node/register/transpile-only',
    runnerPath,
    '--implementation',
    implementationPath,
  ];
  if (quick) args.push('--quick');

  const child = spawnSync(process.execPath, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: benchmarkEnvironment(repositoryRoot),
    maxBuffer: 10 * 1024 * 1024,
  });
  if (child.status !== 0) {
    throw new Error(`benchmark report failed:\n${child.stderr}`);
  }
  return JSON.parse(child.stdout);
}

function renderReport(
  gate: PerformanceGateReport,
  baseRevision: string,
  headRevision: string,
): string {
  const lines = [
    '# createFromJSON performance regression gate',
    '',
    `Status: **${gate.status.toUpperCase()}**`,
    '',
    `Base: \`${baseRevision}\``,
    `Head: \`${headRevision}\``,
    '',
    '| Dataset | Metric | Baseline | Candidate | Median regression | 95% lower bound | Control noise p75 | Allowed | Status |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const cell of gate.cells) {
    lines.push(
      `| ${cell.dataset} | ${cell.metric} | ${cell.baselineMedian} | ${cell.candidateMedian} | ${cell.medianRegressionPercent}% | ${cell.regressionLowerConfidenceBoundPercent}% | ${cell.controlNoiseP75Percent}% | ${cell.allowedRegressionPercent}% | ${cell.status} |`,
    );
  }
  lines.push(
    '',
    `Each baseline contains ${
      gate.cells[0]?.baselineSamples || 0
    } fresh-process samples; each candidate contains ${
      gate.cells[0]?.candidateSamples || 0
    }.`,
    '',
  );
  return `${lines.join('\n')}\n`;
}

function assertNode20(): void {
  if (process.versions.node.split('.')[0] !== '20') {
    throw new Error(
      `performance gate requires Node 20; received ${process.version}`,
    );
  }
}

function git(repositoryRoot: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim();
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readIntegerOption(
  args: string[],
  name: string,
  defaultValue: number,
): number {
  const value = Number(readStringOption(args, name, String(defaultValue)));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
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

function readOptionalStringOption(
  args: string[],
  name: string,
): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

if (require.main === module) {
  main();
}
