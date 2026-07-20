import * as fc from 'fast-check';

import { DepGraphData } from '../../../../src';
import { cloneDepGraphData } from './canonicalize';
import { validGraphDataArbitrary } from './graph-arbitrary';

export const GENERATED_INVALID_GRAPH_RUNS = 150;

export type InvalidGraphMutationKind =
  | 'duplicate-package'
  | 'duplicate-node'
  | 'unknown-package'
  | 'unreachable-node'
  | 'incoming-root-edge'
  | 'uninstantiated-package'
  | 'mismatched-package-id';

interface InvalidGraphMutation {
  kind: InvalidGraphMutationKind;
  description: string;
  expectedMessage: string;
  seed: number;
}

export const INVALID_GRAPH_MUTATIONS: readonly InvalidGraphMutation[] = [
  {
    kind: 'duplicate-package',
    description: 'duplicate package id',
    expectedMessage: 'more than one pkg with same id',
    seed: 0x1bad1001,
  },
  {
    kind: 'duplicate-node',
    description: 'duplicate node id',
    expectedMessage: 'more than one node with same id',
    seed: 0x1bad1002,
  },
  {
    kind: 'unknown-package',
    description: 'node referencing an unknown package',
    expectedMessage: 'some instance nodes belong to non-existing pkgIds',
    seed: 0x1bad1003,
  },
  {
    kind: 'unreachable-node',
    description: 'node unreachable from the root',
    expectedMessage: 'not all graph nodes are reachable from root',
    seed: 0x1bad1004,
  },
  {
    kind: 'incoming-root-edge',
    description: 'root node with an incoming edge',
    expectedMessage: 'is not really the root',
    seed: 0x1bad1005,
  },
  {
    kind: 'uninstantiated-package',
    description: 'package without an instance node',
    expectedMessage: 'not all pkgs have instance nodes',
    seed: 0x1bad1006,
  },
  {
    kind: 'mismatched-package-id',
    description: 'package id inconsistent with its package info',
    expectedMessage: 'pkgs ids should be name@version',
    seed: 0x1bad1007,
  },
];

export function invalidGraphDataArbitrary(
  kind: InvalidGraphMutationKind,
): fc.Arbitrary<DepGraphData> {
  return fc
    .tuple(validGraphDataArbitrary({ minNodes: 2 }), fc.nat())
    .map(([validGraph, choice]) => mutateGraph(validGraph, kind, choice));
}

function mutateGraph(
  validGraph: DepGraphData,
  kind: InvalidGraphMutationKind,
  choice: number,
): DepGraphData {
  const graph = cloneDepGraphData(validGraph);

  switch (kind) {
    case 'duplicate-package': {
      const pkg = graph.pkgs[choice % graph.pkgs.length];
      graph.pkgs.push(JSON.parse(JSON.stringify(pkg)));
      break;
    }
    case 'duplicate-node': {
      const node = graph.graph.nodes[choice % graph.graph.nodes.length];
      graph.graph.nodes.push(JSON.parse(JSON.stringify(node)));
      break;
    }
    case 'unknown-package': {
      const node = graph.graph.nodes[choice % graph.graph.nodes.length];
      node.pkgId = `missing-${choice}@1.0.0`;
      break;
    }
    case 'unreachable-node': {
      const nonRootNodes = graph.graph.nodes.filter(
        (node) => node.nodeId !== graph.graph.rootNodeId,
      );
      const target = nonRootNodes[choice % nonRootNodes.length];
      for (const node of graph.graph.nodes) {
        node.deps = node.deps.filter((dep) => dep.nodeId !== target.nodeId);
      }
      break;
    }
    case 'incoming-root-edge': {
      const nonRootNodes = graph.graph.nodes.filter(
        (node) => node.nodeId !== graph.graph.rootNodeId,
      );
      const source = nonRootNodes[choice % nonRootNodes.length];
      source.deps.push({ nodeId: graph.graph.rootNodeId });
      break;
    }
    case 'uninstantiated-package': {
      const name = `orphan-${choice}`;
      graph.pkgs.push({
        id: `${name}@1.0.0`,
        info: { name, version: '1.0.0' },
      });
      break;
    }
    case 'mismatched-package-id': {
      const pkg = graph.pkgs[choice % graph.pkgs.length];
      pkg.id = `${pkg.id}-mismatch`;
      break;
    }
  }

  return graph;
}
