import * as _ from 'lodash';
import * as semver from 'semver';
import * as types from './types';

import { DepGraph, DepGraphData, DepGraphData2, GraphNode } from './types';
import { ValidationError } from './errors';
import { DepGraphImpl } from './dep-graph';
import { validateGraph } from './validate-graph';

export const SUPPORTED_SCHEMA_RANGE = '^1.0.0';

// To be used in .sort()
// Compares entries by derived scalar "key"
function compareByKey<T>(
  key: (x: T) => string | number | boolean,
): (a: T, B: T) => number {
  return (a, b) => {
    const av = key(a);
    const bv = key(b);
    if (av < bv) {
      return -1;
    }
    if (av > bv) {
      return 1;
    }
    return 0;
  };
}

export function createFromJSON(depGraphDataV1OrV2: DepGraphData|DepGraphData2): DepGraph {
  if (!depGraphDataV1OrV2.schemaVersion) {
    throw new ValidationError("Missing schemaVersion");
  }
  if (depGraphDataV1OrV2.schemaVersion.startsWith('2.')) {
    const depGraphData2 = depGraphDataV1OrV2 as DepGraphData2;
    validateGraph(depGraphData2);
    return new DepGraphImpl(depGraphData2);
  } else if (depGraphDataV1OrV2.schemaVersion.startsWith('1.')) {
    const depGraphData = depGraphDataV1OrV2 as DepGraphData;
    validateDepGraphData(depGraphData);

    const res: DepGraphData2 = {
      schemaVersion: '2.0.0',
      pkgManager: depGraphData.pkgManager,
      rootNodeId: depGraphData.graph.rootNodeId,
      // nodes before pkgs, since nodes are usually more interesting when
      // debugging graph issues and thus should come first in JSON
      nodes: {},
      pkgs: {},
    };
    // All the keys are sorted when transforming keys to maps.
    // This is to increase the probability that JSON.stringify will produce
    // identical representations.
    for (const pkg of depGraphData.pkgs.sort(compareByKey((x) => x.id))) {
      res.pkgs[pkg.id] = pkg.info;
      if (!pkg.info.version) {
        res.pkgs[pkg.id].version = undefined as any;
      }
    }
    for (const node of depGraphData.graph.nodes.sort(compareByKey((x) => x.nodeId))) {
      const depsMap: Record<string, {}> = {};
      node.deps.sort(compareByKey((x) => x.nodeId)).forEach((d) => depsMap[d.nodeId] = {});
      res.nodes[node.nodeId] = {
        pkgId: node.pkgId,
        deps: depsMap,
        info: node.info,
      };
    }

    validateGraph(res);

    return new DepGraphImpl(
      res,
    );
  } else {
    throw new ValidationError("Unknown schemaVersion: " + depGraphDataV1OrV2.schemaVersion);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new ValidationError(msg);
  }
}

function validateDepGraphData(depGraphData: DepGraphData) {
  assert(
    !!semver.valid(depGraphData.schemaVersion)
      && semver.satisfies(depGraphData.schemaVersion, SUPPORTED_SCHEMA_RANGE),
    `dep-graph schemaVersion not in "${SUPPORTED_SCHEMA_RANGE}"`);
  assert(depGraphData.pkgManager && !!depGraphData.pkgManager.name, '.pkgManager.name is missing');

  const pkgsMap = depGraphData.pkgs.reduce((acc, cur) => {
    assert(!(cur.id in acc), 'more than one pkg with same id');
    assert(!!cur.info, '.pkgs item missing .info');

    acc[cur.id] = cur.info;
    return acc;
  }, {} as {[pkdId: string]: types.PkgInfo});

  const nodesMap = depGraphData.graph.nodes.reduce((acc, cur) => {
    assert(!(cur.nodeId in acc), 'more than on node with same id');

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
  assert(_.values(nodesMap)
      .filter((node) => !(node.pkgId in pkgsMap))
      .length === 0,
    'some instance nodes belong to non-existing pkgIds');
  assert(_.values(pkgsMap)
      .filter((pkg: { name: string }) => !pkg.name)
      .length === 0,
    'some .pkgs elements have no .name field');
}
