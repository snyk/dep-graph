import * as _ from 'lodash';
import * as semver from 'semver';
import * as graphlib from 'graphlib';

import { DepGraph, DepGraphData, GraphNode } from './types';
import { validateGraph } from './validate-graph';
import { DepGraphImpl } from './dep-graph';

export const SUPPORTED_SCHEMA_RANGE = '^2.0.0';

export function createFromJSON(depGraphData: DepGraphData): DepGraph {
  validateDepGraphData(depGraphData);

  const graph = new graphlib.Graph({
    directed: true,
    multigraph: false,
    compound: false,
  });
  const pkgs = {};
  const pkgNodes: { [pkgId: string]: Set<string> } = {};

  for (const pkgId of Object.keys(depGraphData.pkgs)) {
    const pkg = depGraphData.pkgs[pkgId];
    pkgs[pkgId] = pkg.version ? pkg : { ...pkg, version: null };
  }

  for (const nodeId of Object.keys(depGraphData.graph)) {
    const node = depGraphData.graph[nodeId];
    const pkgId = node.pkgId;
    if (!pkgNodes[pkgId]) {
      pkgNodes[pkgId] = new Set();
    }
    pkgNodes[pkgId].add(nodeId);

    graph.setNode(nodeId, { pkgId });
  }

  for (const nodeId of Object.keys(depGraphData.graph)) {
    const node = depGraphData.graph[nodeId];
    for (const depNodeId of node.deps) {
      graph.setEdge(nodeId, depNodeId.nodeId);
    }
  }

  validateGraph(graph, 'root', pkgs, pkgNodes);

  return new DepGraphImpl(
    graph,
    pkgs as any,
    pkgNodes,
    depGraphData.pkgManager,
  );
}

function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(msg);
  }
}

function validateDepGraphData(data: DepGraphData) {
  assert(data.schemaVersion, `schemaVersion missing`);
  assert(semver.satisfies(data.schemaVersion, SUPPORTED_SCHEMA_RANGE),
    `schemaVersion not in "${SUPPORTED_SCHEMA_RANGE}"`);
  assert(data.pkgManager && data.pkgs && data.graph,
    'bad data format');

  assert(data.pkgManager.name, '.pkgManager.name is missing');
  assert(data.pkgs.root, `root pkg missing`);
  assert(data.pkgs.root.name, `root pkg missing`);
  assert(data.graph.root, `root graph node is missing`);
  assert(data.graph.root.pkgId === 'root',
    `the root node .pkgId must be "root", but got ${data.graph.root.pkgId}`);

  for (const pkgId of _.keys(data.pkgs)) {
    const pkg = data.pkgs[pkgId];
    assert(!!pkg, 'empty pkg');
    assert(pkg.name, 'some .pkgs elements have no .name field');
    // NOTE: this name@version check is very strict,
    // we can relax it later, it just makes things easier now
    assert(pkgId === 'root' || pkgId === `${pkg.name}@${pkg.version || ''}`,
      'non-root pkg id must be name@version');
  }

  for (const node of _.values(data.graph)) {
    assert(data.pkgs[node.pkgId],
      'a node points to a non-existing pkgId');
  }
}
