import * as _ from 'lodash';
import * as crypto from 'crypto';
import * as types from '../core/types';
import { DepGraphBuilder } from '../core/builder';

export {
  depTreeToGraph,
  DepTree,
};

interface DepTree {
  name?: string; // shouldn't, but might happen
  version?: string; // shouldn't, but might happen
  dependencies?: {
    [depName: string]: DepTree,
  };
  targetOS?: {
    name: string;
    version: string;
  };
}

async function depTreeToGraph(depTree: DepTree, packageManagerName: string): Promise<types.DepGraph> {
  const rootPkg = {
    name: depTree.name,
    version: depTree.version,
  };

  const pkgManagerInfo: types.PkgManager = {
    name: packageManagerName,
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

  return builder.build();
}

async function buildGraph(
  builder: DepGraphBuilder, depTree: DepTree, pkgName: string, isRoot = false): Promise<string> {

  const getNodeId = (name, version, hashId) => `${name}@${version}|${hashId}`;

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

  // TODO(shaun): decide on trimming
  // const treeHash = depNames.length ? hash.digest('hex') : '';
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

async function spinTheEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}
