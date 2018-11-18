import * as _ from 'lodash';
import * as semver from 'semver';

import { DepGraph, DepGraphData } from './types';
import { DepGraphImpl } from './dep-graph';

export const SUPPORTED_SCHEMA_RANGE = '^2.0.0';

export function createFromJSON(depGraphData: DepGraphData): DepGraph {
  validateDepGraphData(depGraphData);
  return new DepGraphImpl(depGraphData);
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

  // validate packages
  for (const pkgId of Object.keys(data.pkgs)) {
    const pkg = data.pkgs[pkgId];
    assert(!!pkg, 'empty pkg');
    assert(pkg.name, 'some .pkgs elements have no .name field');
    // NOTE: this name@version check is very strict,
    // we can relax it later, it just makes things easier now
    assert(pkgId === 'root' || pkgId === `${pkg.name}@${pkg.version || ''}`,
      'non-root pkg id must be name@version');
  }

  // validate nodes
  const pkgIdsSeen: Set<string> = new Set();
  for (const [nodeId, node] of _.entries(data.graph)) {
    pkgIdsSeen.add(node.pkgId);
    assert(node.pkgId !== 'root' || nodeId === 'root',
      'root pkg should have exactly one instance node');
    assert(data.pkgs[node.pkgId], 'node points to a non-existing pkgId');
    for (const depNodeId of node.deps) {
      // TODO(shaun): better error
      assert(depNodeId !== 'root', `"root" is not really the root`);
      // TODO(shaun): test
      assert(!data.graph[depNodeId], 'node depends on a non-existing nodeId');
    }
  }
  assert(pkgIdsSeen.size === Object.keys(data.pkgs).length,
    'not all pkgs have instance nodes');

  function nodesReachableFrom(
    nodeId: string,
    reachable: Set<string> = new Set()) {

    reachable.add(nodeId);
    const node = data.graph[nodeId];
    for (const dep of node.deps) {
      if (!reachable.has(dep.nodeId)) {
        nodesReachableFrom(dep.nodeId, reachable);
      }
    }
    return reachable;
  }

  assert(nodesReachableFrom('root').size === Object.keys(data.graph).length,
    'not all graph nodes are reachable from root');
}
