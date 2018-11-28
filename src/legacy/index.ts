import * as _ from 'lodash';
import * as crypto from 'crypto';
import * as types from '../core/types';
import { DepGraphBuilder } from '../core/builder';

export {
  depTreeToGraph,
  DepTree,
};

interface DepTreeDep {
  name?: string; // shouldn't, but might happen
  version?: string; // shouldn't, but might happen
  dependencies?: {
    [depName: string]: DepTreeDep,
  };
}

interface DepTree extends DepTreeDep {
  targetOS?: {
    name: string;
    version: string;
  };
}

async function depTreeToGraph(depTree: DepTree, pkgManagerName: string): Promise<types.DepGraph> {
  const rootPkg = {
    name: depTree.name,
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

  await buildGraph(builder, depTree, depTree.name, true);

  const depGraph = await builder.build();

  return shortenNodeIds(depGraph as types.DepGraphInternal);
}

async function buildGraph(
  builder: DepGraphBuilder, depTree: DepTreeDep, pkgName: string, isRoot = false): Promise<string> {

  const getNodeId = (name, version, hashId) => `${name}@${version || ''}|${hashId}`;

  const depNodesIds = [];

  const hash = crypto.createHash('sha1');

  const deps = depTree.dependencies || {};
  const depNames = _.keys(deps).sort();
  for (const depName of depNames) {
    const dep = deps[depName];

    const subtreeHash = await buildGraph(builder, dep, depName);

    const depPkg = {
      name: depName,
      version: dep.version,
    };

    const depNodeId = getNodeId(depPkg.name, depPkg.version, subtreeHash);

    depNodesIds.push(depNodeId);

    builder.addPkgNode(depPkg, depNodeId);

    hash.update(depNodeId);
  }

  const treeHash = depNames.length ? hash.digest('hex') : 'leaf';

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
    builder.addPkgNode(pkg, pkgNodeId);
  }

  for (const depNodeId of depNodesIds) {
    builder.connectDep(pkgNodeId, depNodeId);
  }

  if (depNodesIds.length > 0) {
    await spinTheEventLoop();
  }
  return treeHash;
}

async function shortenNodeIds(depGraph: types.DepGraphInternal): Promise<types.DepGraph> {
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

      let newNodeId: string;
      if (nodeIds.length === 1) {
        newNodeId = `${trimAfterLastSep(nodeId, '|')}`;
      } else {
        newNodeId = `${trimAfterLastSep(nodeId, '|')}|${i + 1}`;
      }

      nodesMap[nodeId] = newNodeId;
      builder.addPkgNode(pkg, newNodeId);
    }

    await spinTheEventLoop();
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

    await spinTheEventLoop();
  }

  return builder.build();
}

async function spinTheEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

function trimAfterLastSep(str: string, sep: string) {
  return str.slice(0, str.lastIndexOf(sep));
}
