import * as crypto from 'crypto';
import { eventLoopSpinner } from 'event-loop-spinner';

import * as types from '../core/types';
import { DepGraphBuilder } from '../core/builder';
import objectHash = require('object-hash');
import { getCycle, partitionCycles, Cycles } from './cycles';
import { getMemoizedDepTree, memoize, MemoizationMap } from './memiozation';

export { depTreeToGraph, graphToDepTree, DepTree };

interface DepTreeDep {
  name?: string; // shouldn't, but might happen
  version?: string; // shouldn't, but might happen
  versionProvenance?: types.VersionProvenance;
  dependencies?: {
    [depName: string]: DepTreeDep;
  };
  labels?: {
    [key: string]: string | undefined;
    scope?: 'dev' | 'prod';
    pruned?: 'cyclic' | 'true';
  };
  purl?: string;
}

/**
 * @deprecated Use {@link DepGraph} instead of DepTree. You can construct a
 * graph with {@link DepGraphBuilder}
 */
interface DepTree extends DepTreeDep {
  type?: string;
  packageFormatVersion?: string;
  targetOS?: {
    name: string;
    version: string;
  };
}

function addLabel(dep: DepTreeDep, key: string, value: string) {
  if (!dep.labels) {
    dep.labels = {};
  }
  dep.labels[key] = value;
}

/**
 * @deprecated Don't use dep trees as an intermediate step, because they are
 * large structures, resulting in high memory usage and high CPU costs from
 * serializing / deserializing. Instead, create a graph directly with
 * {@link DepGraphBuilder}
 */
async function depTreeToGraph(
  depTree: DepTree,
  pkgManagerName: string,
): Promise<types.DepGraph> {
  const rootPkg: types.PkgInfo = {
    name: depTree.name!,
    version: depTree.version || undefined,
  };
  if (depTree.purl) {
    rootPkg.purl = depTree.purl;
  }

  const pkgManagerInfo: types.PkgManager = {
    name: pkgManagerName,
  };

  const targetOS = depTree.targetOS;
  if (targetOS) {
    pkgManagerInfo.repositories = [
      {
        alias: `${targetOS.name}:${targetOS.version}`,
      },
    ];
  }

  const builder = new DepGraphBuilder(pkgManagerInfo, rootPkg);

  await buildGraph(builder, depTree, depTree.name!, true);

  const depGraph = await builder.build();

  return shortenNodeIds(depGraph as types.DepGraphInternal);
}

async function buildGraph(
  builder: DepGraphBuilder,
  depTree: DepTreeDep,
  pkgName: string,
  isRoot = false,
  memoizationMap: Map<DepTree, string> = new Map(),
): Promise<string> {
  if (memoizationMap.has(depTree)) {
    return memoizationMap.get(depTree)!;
  }
  const getNodeId = (
    name: string,
    version: string | undefined,
    hashId: string,
  ) => `${name}@${version || ''}|${hashId}`;

  const depNodesIds: string[] = [];

  const hash = crypto.createHash('sha1');
  if (depTree.versionProvenance) {
    hash.update(objectHash(depTree.versionProvenance));
  }
  if (depTree.labels) {
    hash.update(objectHash(depTree.labels));
  }

  const deps = depTree.dependencies || {};
  // filter-out invalid null deps (shouldn't happen - but did...)
  const depNames = Object.keys(deps).filter((d) => !!deps[d]);
  for (const depName of depNames.sort()) {
    const dep = deps[depName];

    const subtreeHash = await buildGraph(
      builder,
      dep,
      depName,
      false,
      memoizationMap,
    );

    const depPkg: types.PkgInfo = {
      name: depName,
      version: dep.version,
    };

    if (dep.purl) {
      depPkg.purl = dep.purl;
    }

    const depNodeId = getNodeId(depPkg.name, depPkg.version, subtreeHash);

    depNodesIds.push(depNodeId);

    const nodeInfo: types.NodeInfo = {};

    if (dep.versionProvenance) {
      nodeInfo.versionProvenance = dep.versionProvenance;
    }
    if (dep.labels) {
      nodeInfo.labels = dep.labels;
    }

    builder.addPkgNode(depPkg, depNodeId, nodeInfo);

    hash.update(depNodeId);
  }

  const treeHash = hash.digest('hex');

  let pkgNodeId;
  if (isRoot) {
    pkgNodeId = builder.rootNodeId;
  } else {
    // we don't assume depTree has a .name to support output of `npm list --json`
    const pkg = {
      name: pkgName,
      version: depTree.version,
    };
    pkgNodeId = getNodeId(pkg.name, pkg.version, treeHash);

    const nodeInfo: types.NodeInfo = {};

    if (depTree.versionProvenance) {
      nodeInfo.versionProvenance = depTree.versionProvenance;
    }
    if (depTree.labels) {
      nodeInfo.labels = depTree.labels;
    }

    builder.addPkgNode(pkg, pkgNodeId, nodeInfo);
  }

  for (const depNodeId of depNodesIds) {
    builder.connectDep(pkgNodeId, depNodeId);
  }

  if (depNodesIds.length > 0 && eventLoopSpinner.isStarving()) {
    await eventLoopSpinner.spin();
  }
  memoizationMap.set(depTree, treeHash);
  return treeHash;
}

async function shortenNodeIds(
  depGraph: types.DepGraphInternal,
): Promise<types.DepGraph> {
  const builder = new DepGraphBuilder(depGraph.pkgManager, depGraph.rootPkg);

  const nodesMap: { [key: string]: string } = {};

  // create nodes with shorter ids
  for (const pkg of depGraph.getPkgs()) {
    const nodeIds = depGraph.getPkgNodeIds(pkg);
    for (let i = 0; i < nodeIds.length; i++) {
      const nodeId = nodeIds[i];
      if (nodeId === depGraph.rootNodeId) {
        continue;
      }
      const nodeInfo = depGraph.getNode(nodeId);

      let newNodeId: string;
      if (nodeIds.length === 1) {
        newNodeId = `${trimAfterLastSep(nodeId, '|')}`;
      } else {
        newNodeId = `${trimAfterLastSep(nodeId, '|')}|${i + 1}`;
      }

      nodesMap[nodeId] = newNodeId;
      builder.addPkgNode(pkg, newNodeId, nodeInfo);
    }

    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
  }

  // connect nodes
  for (const pkg of depGraph.getPkgs()) {
    for (const nodeId of depGraph.getPkgNodeIds(pkg)) {
      for (const depNodeId of depGraph.getNodeDepsNodeIds(nodeId)) {
        const parentNode = nodesMap[nodeId] || nodeId;
        const childNode = nodesMap[depNodeId] || depNodeId;

        builder.connectDep(parentNode, childNode);
      }
    }

    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
  }

  return builder.build();
}

export interface GraphToTreeOptions {
  deduplicateWithinTopLevelDeps: boolean;
}

/**
 * @deprecated Don't use dep trees. You should adapt your code to use graphs,
 * and enhance the dep-graph library if there is missing functionality from
 * the graph structure
 */
async function graphToDepTree(
  depGraphInterface: types.DepGraph,
  pkgType: string,
  opts: GraphToTreeOptions = { deduplicateWithinTopLevelDeps: false },
): Promise<DepTree> {
  const depGraph = depGraphInterface as types.DepGraphInternal;

  const [depTree] = await buildSubtree(
    depGraph,
    depGraph.rootNodeId,
    opts.deduplicateWithinTopLevelDeps ? null : false,
  );

  depTree.type = depGraph.pkgManager.name;
  depTree.packageFormatVersion = constructPackageFormatVersion(pkgType);

  const targetOS = constructTargetOS(depGraph);
  if (targetOS) {
    depTree.targetOS = targetOS;
  }

  return depTree;
}

function constructPackageFormatVersion(pkgType: string): string {
  if (pkgType === 'maven') {
    pkgType = 'mvn';
  }
  return `${pkgType}:0.0.1`;
}

function constructTargetOS(
  depGraph: types.DepGraph,
): { name: string; version: string } | void {
  if (
    ['apk', 'apt', 'deb', 'rpm', 'linux'].indexOf(depGraph.pkgManager.name) ===
    -1
  ) {
    // .targetOS is undefined unless its a linux pkgManager
    return;
  }

  if (
    !depGraph.pkgManager.repositories ||
    !depGraph.pkgManager.repositories.length ||
    !depGraph.pkgManager.repositories[0].alias
  ) {
    throw new Error('Incomplete .pkgManager, could not create .targetOS');
  }

  const [name, version] = depGraph.pkgManager.repositories[0].alias.split(':');
  return { name, version };
}

async function buildSubtree(
  depGraph: types.DepGraphInternal,
  nodeId: string,
  maybeDeduplicationSet: Set<string> | false | null = false, // false = disabled; null = not in deduplication scope yet
  ancestors: string[] = [],
  memoizationMap: MemoizationMap = new Map(),
): Promise<[DepTree, Cycles | undefined]> {
  if (!maybeDeduplicationSet) {
    const memoizedDepTree = getMemoizedDepTree(
      nodeId,
      ancestors,
      memoizationMap,
    );
    if (memoizedDepTree) {
      return [memoizedDepTree, undefined];
    }
  }
  const isRoot = nodeId === depGraph.rootNodeId;
  const nodePkg = depGraph.getNodePkg(nodeId);
  const nodeInfo = depGraph.getNode(nodeId);
  const depTree: DepTree = {};
  depTree.name = nodePkg.name;
  depTree.version = nodePkg.version;
  if (nodeInfo.versionProvenance) {
    depTree.versionProvenance = nodeInfo.versionProvenance;
  }
  if (nodeInfo.labels) {
    depTree.labels = { ...nodeInfo.labels };
  }

  const depInstanceIds = depGraph.getNodeDepsNodeIds(nodeId);
  if (!depInstanceIds || depInstanceIds.length === 0) {
    memoizationMap.set(nodeId, { depTree });
    return [depTree, undefined];
  }

  const cycle = getCycle(ancestors, nodeId);
  if (cycle) {
    // This node starts a cycle and now it's the second visit.
    addLabel(depTree, 'pruned', 'cyclic');
    return [depTree, [cycle]];
  }

  if (maybeDeduplicationSet) {
    if (maybeDeduplicationSet.has(nodeId)) {
      if (depInstanceIds.length > 0) {
        addLabel(depTree, 'pruned', 'true');
      }
      return [depTree, undefined];
    }
    maybeDeduplicationSet.add(nodeId);
  }

  const cycles: Cycles = [];
  for (const depInstId of depInstanceIds) {
    // Deduplication of nodes occurs only within a scope of a top-level dependency.
    // Therefore, every top-level dep gets an independent set to track duplicates.
    if (isRoot && maybeDeduplicationSet !== false) {
      maybeDeduplicationSet = new Set();
    }
    const [subtree, subtreeCycles] = await buildSubtree(
      depGraph,
      depInstId,
      maybeDeduplicationSet,
      ancestors.concat(nodeId),
      memoizationMap,
    );
    if (subtreeCycles) {
      for (const cycle of subtreeCycles) {
        cycles.push(cycle);
      }
    }
    if (!subtree) {
      continue;
    }

    if (!depTree.dependencies) {
      depTree.dependencies = {};
    }

    depTree.dependencies[subtree.name!] = subtree;
  }

  if (eventLoopSpinner.isStarving()) {
    await eventLoopSpinner.spin();
  }

  const partitionedCycles = partitionCycles(nodeId, cycles);
  memoize(nodeId, memoizationMap, depTree, partitionedCycles);

  return [depTree, partitionedCycles.cyclesWithThisNode];
}

function trimAfterLastSep(str: string, sep: string) {
  return str.slice(0, str.lastIndexOf(sep));
}
