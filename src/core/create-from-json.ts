import * as _ from 'lodash';
import * as semver from 'semver';
import * as graphlib from 'graphlib';

import { DepGraph, DepGraphData, GraphNode } from './types';
import { validateGraph } from './validate-graph';
import { DepGraphImpl } from './dep-graph';

export const SUPPORTED_SCHEMA_RANGE = '^1.0.0';

export function createFromJSON(depGraphData: DepGraphData): DepGraph {
  validateDepGraphData(depGraphData);

  const graph = new graphlib.Graph({
    directed: true,
    multigraph: false,
    compound: false,
  });
  const pkgs = {};
  const pkgNodes = {};

  for (const { id, info } of depGraphData.pkgs) {
    pkgs[id] = info.version ? info : { ...info, version: null };
  }

  for (const node of depGraphData.graph.nodes) {
    const pkgId = node.pkgId;
    if (!pkgNodes[pkgId]) {
      pkgNodes[pkgId] = new Set();
    }
    pkgNodes[pkgId].add(node.nodeId);

    graph.setNode(node.nodeId, { pkgId });
  }

  for (const node of depGraphData.graph.nodes) {
    for (const depNodeId of node.deps) {
      graph.setEdge(node.nodeId, depNodeId.nodeId);
    }
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
    throw new Error(msg);
  }
}

function validateDepGraphData(depGraphData: DepGraphData) {
  assert(semver.satisfies(depGraphData.schemaVersion, SUPPORTED_SCHEMA_RANGE),
    `dep-graph schemaVersion not in "${SUPPORTED_SCHEMA_RANGE}"`);
  assert(depGraphData.pkgManager && !!depGraphData.pkgManager.name, '.pkgManager.name is missing');

  const pkgsMap = depGraphData.pkgs.reduce((acc, cur) => {
    if (cur.id in acc) {
      assert(false, 'more than one pkg with same id');
    }

    acc[cur.id] = cur.info;
    return acc;
  }, {});

  const nodesMap = depGraphData.graph.nodes.reduce((acc, cur) => {
    if (cur.nodeId in acc) {
      assert(false, 'more than on node with same id');
    }

    acc[cur.nodeId] = cur;
    return acc;
  }, {} as { [nodeId: string]: GraphNode });

  const rootNodeId = depGraphData.graph.rootNodeId;
  const rootNode = nodesMap[rootNodeId];
  assert(rootNodeId in nodesMap, `.${rootNodeId} root graph node is missing`);
  const rootPkgId = rootNode.pkgId;
  assert(rootPkgId in pkgsMap, `.${rootPkgId} root pkg missing`);
  assert(nodesMap[rootNodeId].pkgId === rootPkgId,
    `the root node .pkgId should be "${rootPkgId}"`);
  const pkgIds = _.keys(pkgsMap);
  // NOTE: this name@version check is very strict,
  // we can relax it later, it just makes things easier now
  assert(
    pkgIds
      .filter((pkgId) => (pkgId !== DepGraphImpl.getPkgId(pkgsMap[pkgId])))
      .length === 0,
    'pkgs ids should be name@version');
  assert(_.values(nodesMap).filter((node) =>
    !(node.pkgId in pkgsMap),
  ).length === 0,
    'some instance nodes belong to non-existing pkgIds');
  assert(_.values(pkgsMap).filter((pkg: { name: string }) =>
    !pkg.name,
  ).length === 0,
    'some .pkgs elements have no .name field');
}
