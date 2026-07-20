import { readFileSync } from 'fs';
import { join } from 'path';

import { DepGraphData } from '../../src';
import { BenchmarkDataset, DatasetConfiguration, DatasetName } from './types';

export const DATASET_CONFIGS: readonly DatasetConfiguration[] = [
  {
    name: 'real-golang-646',
    kind: 'fixture',
    nodes: 646,
    packages: 646,
    edges: 2688,
  },
  {
    name: 'synthetic-5000',
    kind: 'synthetic',
    nodes: 5000,
    packages: 2500,
    edges: 9994,
  },
  {
    name: 'synthetic-20000',
    kind: 'synthetic',
    nodes: 20000,
    packages: 10000,
    edges: 39994,
  },
];

export function createDataset(name: DatasetName): BenchmarkDataset {
  const configuration = DATASET_CONFIGS.find(
    (candidate) => candidate.name === name,
  );
  if (!configuration) {
    throw new Error(`unknown createFromJSON benchmark dataset: ${name}`);
  }

  const data =
    configuration.kind === 'fixture'
      ? loadFixture()
      : createSyntheticGraphData(configuration.nodes);

  return { ...configuration, data };
}

export function datasetConfiguration(
  dataset: BenchmarkDataset,
): DatasetConfiguration {
  return {
    name: dataset.name,
    kind: dataset.kind,
    nodes: dataset.nodes,
    packages: dataset.packages,
    edges: dataset.edges,
  };
}

export function memoryRetainedGraphCount(name: DatasetName): number {
  if (name === 'real-golang-646') return 32;
  if (name === 'synthetic-5000') return 8;
  return 3;
}

function loadFixture(): DepGraphData {
  const fixturePath = join(
    __dirname,
    '..',
    'fixtures',
    'big-golang-graph.json',
  );
  return JSON.parse(readFileSync(fixturePath, { encoding: 'utf8' }));
}

function createSyntheticGraphData(nodeCount: number): DepGraphData {
  const packageCount = Math.ceil(nodeCount / 2);
  const pkgs = Array.from({ length: packageCount }, (_, index) => ({
    id: `generated-${index}@1.0.${index % 100}`,
    info: {
      name: `generated-${index}`,
      version: `1.0.${index % 100}`,
      ...(index % 10 === 0
        ? { purl: `pkg:npm/generated-${index}@1.0.${index % 100}` }
        : {}),
    },
  }));
  const dependencies = Array.from(
    { length: nodeCount },
    () => new Set<number>(),
  );

  for (let target = 1; target < nodeCount; target += 1) {
    const treeParent = Math.floor((target - 1) / 4);
    dependencies[treeParent].add(target);
  }
  for (let target = 5; target < nodeCount; target += 1) {
    dependencies[0].add(target);
  }

  const nodes = Array.from({ length: nodeCount }, (_, index) => {
    const pkg = pkgs[index % packageCount];
    return {
      nodeId: `generated-node-${index}`,
      pkgId: pkg.id,
      ...(index % 10 === 0
        ? { info: { labels: { source: 'synthetic-benchmark' } } }
        : {}),
      deps: Array.from(dependencies[index], (target) => ({
        nodeId: `generated-node-${target}`,
      })),
    };
  });

  return {
    schemaVersion: '1.3.0',
    pkgManager: { name: 'npm', version: '10.0.0' },
    pkgs,
    graph: { rootNodeId: 'generated-node-0', nodes },
  };
}
