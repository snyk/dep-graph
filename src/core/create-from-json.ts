import * as semver from 'semver';
import * as graphlib from '../graphlib';
import * as types from './types';

import { DepGraph, DepGraphData } from './types';
import { ValidationError } from './errors';
import { validateGraph } from './validate-graph';
import { DepGraphImpl } from './dep-graph';

export const SUPPORTED_SCHEMA_RANGE = '^1.0.0';

/**
 * Create a DepGraph instance from a JSON representation of a dep graph. This
 * is typically used after passing the graph over the wire as `DepGraphData`.
 */
export function createFromJSON(depGraphData: DepGraphData): DepGraph {
  assertValidSchema(depGraphData);

  const graph = new graphlib.Graph({
    directed: true,
    multigraph: false,
    compound: false,
  });
  const pkgs: { [pkgId: string]: types.PkgInfo } = {};
  const pkgNodes: { [pkgId: string]: Set<string> } = {};

  for (const { id, info } of depGraphData.pkgs) {
    assertValidPkg(id, info, pkgs);
    pkgs[id] = info.version ? info : { ...info, version: undefined };
  }

  const rootNodeId = depGraphData.graph.rootNodeId;
  let rootNode;

  for (const node of depGraphData.graph.nodes) {
    assert(!graph.hasNode(node.nodeId), 'more than one node with same id');

    if (node.nodeId === rootNodeId) rootNode = node;
    assert(
      !!pkgs[node.pkgId],
      'some instance nodes belong to non-existing pkgIds',
    );
    const pkgId = node.pkgId;
    if (!pkgNodes[pkgId]) {
      pkgNodes[pkgId] = new Set();
    }
    pkgNodes[pkgId].add(node.nodeId);

    graph.setNode(node.nodeId, { pkgId, info: node.info });
  }

  for (const node of depGraphData.graph.nodes) {
    for (const depNodeId of node.deps) {
      graph.setEdge(node.nodeId, depNodeId.nodeId);
    }
  }

  assert(!!rootNode, `.${rootNodeId} root graph node is missing`);
  const rootPkgId = rootNode.pkgId;
  assert(!!pkgs[rootPkgId], `.${rootPkgId} root pkg missing`);

  validateGraph(graph, depGraphData.graph.rootNodeId, pkgs, pkgNodes);

  return new DepGraphImpl(
    graph,
    depGraphData.graph.rootNodeId,
    pkgs,
    pkgNodes,
    depGraphData.pkgManager,
  );
}

export async function asyncCreateFromJSON(depGraphData: DepGraphData, eventLoopSpinner?: any): Promise<DepGraph> {
  validateDepGraphData(depGraphData);

  const graph = new graphlib.Graph({
    directed: true,
    multigraph: false,
    compound: false,
  });
  const pkgs: { [pkgId: string]: types.PkgInfo } = {};
  const pkgNodes: { [pkgId: string]: Set<string> } = {};

  for (const { id, info } of depGraphData.pkgs) {
    pkgs[id] = info.version ? info : { ...info, version: undefined };
  }

  for (const node of depGraphData.graph.nodes) {
    const pkgId = node.pkgId;
    if (!pkgNodes[pkgId]) {
      pkgNodes[pkgId] = new Set();
    }
    pkgNodes[pkgId].add(node.nodeId);

    graph.setNode(node.nodeId, { pkgId, info: node.info });
  }

  for (const node of depGraphData.graph.nodes) {
    if (eventLoopSpinner && eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
    for (const depNodeId of node.deps) {
      graph.setEdge(node.nodeId, depNodeId.nodeId);
    }
  }

  if (eventLoopSpinner && eventLoopSpinner.isStarving()) {
    await eventLoopSpinner.spin();
  }
  validateGraph(graph, depGraphData.graph.rootNodeId, pkgs, pkgNodes);

  return new DepGraphImpl(
    graph,
    depGraphData.graph.rootNodeId,
    pkgs,
    pkgNodes,
    depGraphData.pkgManager,
  );
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new ValidationError(msg);
  }
}

function assertValidSchema({ schemaVersion, pkgManager }: DepGraphData) {
  assert(
    !!semver.valid(schemaVersion) &&
      semver.satisfies(schemaVersion, SUPPORTED_SCHEMA_RANGE),
    `dep-graph schemaVersion not in "${SUPPORTED_SCHEMA_RANGE}"`,
  );
  assert(pkgManager && !!pkgManager.name, '.pkgManager.name is missing');
}

function assertValidPkg(id, info, pkgs) {
  assert(!pkgs[id], 'more than one pkg with same id');
  assert(!!info, '.pkgs item missing .info');
  assert(id === DepGraphImpl.getPkgId(info), 'pkgs ids should be name@version');
  assert(!!info.name, 'some .pkgs elements have no .name field');
}
