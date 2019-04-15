import * as _ from 'lodash';
import * as crypto from 'crypto';
import * as types from '../core/types';
import { DepGraphBuilder } from '../core/builder';
import { EventLoopSpinner } from './event-loop-spinner';

import objectHash = require('object-hash');

export {
  depTreeToGraph,
  graphToDepTree,
  DepTree,
};

interface DepTreeDep {
  name?: string; // shouldn't, but might happen
  version?: string; // shouldn't, but might happen
  versionProvenance?: types.VersionProvenance;
  dependencies?: {
    [depName: string]: DepTreeDep,
  };
}

interface DepTree extends DepTreeDep {
  type?: string;
  packageFormatVersion?: string;
  targetOS?: {
    name: string;
    version: string;
  };
}

async function depTreeToGraph(depTree: DepTree, pkgManagerName: string): Promise<types.DepGraph> {
  const rootPkg = {
    name: depTree.name!,
    version: depTree.version,
  };

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

  const eventLoopSpinner = new EventLoopSpinner();
  await buildGraph(builder, depTree, depTree.name!, eventLoopSpinner, true);

  const depGraph = await builder.build();

  return shortenNodeIds(depGraph as types.DepGraphInternal, eventLoopSpinner);
}

async function buildGraph(
    builder: DepGraphBuilder,
    depTree: DepTreeDep,
    pkgName: string,
    eventLoopSpinner: EventLoopSpinner,
    isRoot = false): Promise<string> {

  const getNodeId = (name: string, version: string | undefined, hashId: string) =>
    `${name}@${version || ''}|${hashId}`;

  const depNodesIds = [];

  const hash = crypto.createHash('sha1');
  if (depTree.versionProvenance) {
    hash.update(objectHash(depTree.versionProvenance));
  }

  const deps = depTree.dependencies || {};
  // filter-out invalid null deps (shouldn't happen - but did...)
  const depNames = _.keys(deps).filter((d) => !!deps[d]);
  for (const depName of depNames.sort()) {
    const dep = deps[depName];

    const subtreeHash = await buildGraph(builder, dep, depName, eventLoopSpinner);

    const depPkg = {
      name: depName,
      version: dep.version,
    };

    const depNodeId = getNodeId(depPkg.name, depPkg.version, subtreeHash);

    depNodesIds.push(depNodeId);

    const nodeInfo: types.NodeInfo = {};

    if (dep.versionProvenance) {
      nodeInfo.versionProvenance = dep.versionProvenance;
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

    builder.addPkgNode(pkg, pkgNodeId, nodeInfo);
  }

  for (const depNodeId of depNodesIds) {
    builder.connectDep(pkgNodeId, depNodeId);
  }

  if (depNodesIds.length > 0 && eventLoopSpinner.isStarving()) {
    await eventLoopSpinner.spin();
  }
  return treeHash;
}

async function shortenNodeIds(
    depGraph: types.DepGraphInternal, eventLoopSpinner: EventLoopSpinner): Promise<types.DepGraph> {
  const builder = new DepGraphBuilder(depGraph.pkgManager, depGraph.rootPkg);

  const nodesMap: {[key: string]: string} = {};

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

async function graphToDepTree(depGraphInterface: types.DepGraph, pkgType: string): Promise<DepTree> {
  const depGraph = (depGraphInterface as types.DepGraphInternal);

  // TODO: implement cycles support
  if (depGraph.hasCycles()) {
    throw new Error('Conversion to DepTree does not support cyclic graphs yet');
  }

  const eventLoopSpinner = new EventLoopSpinner();
  const depTree = await buildSubtree(depGraph, depGraph.rootNodeId, eventLoopSpinner);

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

function constructTargetOS(depGraph: types.DepGraph): { name: string; version: string; } | void {
  if (['apk', 'apt', 'deb', 'rpm'].indexOf(depGraph.pkgManager.name) === -1) {
    // .targetOS is undefined unless its a linux pkgManager
    return;
  }

  if (!depGraph.pkgManager.repositories
    || !depGraph.pkgManager.repositories.length
    || !depGraph.pkgManager.repositories[0].alias) {
      throw new Error('Incomplete .pkgManager, could not create .targetOS');
  }

  const [name, version] = depGraph.pkgManager.repositories[0].alias.split(':');
  return { name, version };
}

async function buildSubtree(
    depGraph: types.DepGraphInternal, nodeId: string, eventLoopSpinner: EventLoopSpinner): Promise<DepTree> {
  const nodePkg = depGraph.getNodePkg(nodeId);
  const nodeInfo = depGraph.getNode(nodeId);
  const depTree: DepTree = {};
  depTree.name = nodePkg.name;
  depTree.version = nodePkg.version;
  if (nodeInfo.versionProvenance) {
    depTree.versionProvenance = nodeInfo.versionProvenance;
  }

  const depInstanceIds = depGraph.getNodeDepsNodeIds(nodeId);
  if (!depInstanceIds || depInstanceIds.length === 0) {
    return depTree;
  }

  for (const depInstId of depInstanceIds) {
    const subtree = await buildSubtree(depGraph, depInstId, eventLoopSpinner);
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
  return depTree;
}

function trimAfterLastSep(str: string, sep: string) {
  return str.slice(0, str.lastIndexOf(sep));
}
