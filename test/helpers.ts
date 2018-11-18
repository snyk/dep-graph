import * as fs from 'fs';
import * as path from 'path';
import * as depGraphLib from '../src';
import * as types from '../src/core/types';
import {DepTree} from '../src/legacy';

export function loadFixture(name: string) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, `fixtures/${name}`), 'utf8'));
}

export function depSort(a, b) {
  if (a.name < b.name) {
    return -1;
  } else if (a.name > b.name) {
    return 1;
  }
  if (a.version < b.version) {
    return -1;
  } else if (a.version > b.version) {
    return 1;
  }
  return 0;
}

export async function graphToDepTree(depGraphInterface: depGraphLib.DepGraph): Promise<DepTree> {

  const depGraph = (depGraphInterface as types.DepGraphInternal);

  // TODO: implement cycles support
  if (depGraph.hasCycles()) {
    throw new Error('Conversion to DepTree does not support cyclic graphs yet');
  }

  const depTree = await buildSubtree(depGraph, 'root');

  (depTree as any).packageFormatVersion = constructPackageFormatVersion(depGraph);

  return depTree;
}

function constructPackageFormatVersion(depGraph: types.DepGraph): string {
  let packageManagerShorthand = depGraph.pkgManager.name;
  if (depGraph.pkgManager.name === 'maven') {
    packageManagerShorthand = 'mvn';
  }
  return `${packageManagerShorthand}:0.0.1`;
}

async function buildSubtree(depGraph: types.DepGraphInternal, nodeId: string): Promise<DepTree> {
  const nodePkg = depGraph.getNodePkg(nodeId);
  const depTree: DepTree = {
    name: nodePkg.name,
    version: nodePkg.version,
    dependencies: {},
  };

  const depInstanceIds = depGraph.getNodeDepsNodeIds(nodeId);
  if (!depInstanceIds || depInstanceIds.length === 0) {
    return depTree;
  }

  for (const depInstId of depInstanceIds) {
    const subtree = await buildSubtree(depGraph, depInstId);
    if (!subtree) {
      continue;
    }

    depTree.dependencies[subtree.name] = subtree;
  }

  await spinTheEventLoop();
  return depTree;
}

async function spinTheEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}
