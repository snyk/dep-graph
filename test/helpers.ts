import * as _isEqual from 'lodash.isequal';
import * as fs from 'fs';
import * as path from 'path';
import * as depGraphLib from '../src';
import { PkgInfo } from '../src';

export function loadFixture(name: string) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, `fixtures/${name}`), 'utf8'),
  );
}

function depCompare(a: any, b: any) {
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

export function expectSamePkgs(actual: PkgInfo[], expected: PkgInfo[]) {
  actual = actual.slice().sort(depCompare);
  expected = expected.slice().sort(depCompare);
  return expect(actual).toEqual(expected);
}

export function depTreesEqual(a: any, b: any) {
  if (a.name !== b.name || a.version !== b.version) {
    return false;
  }

  if (
    !_isEqual(a.labels, b.labels) ||
    !_isEqual(a.versionProvenance, b.versionProvenance)
  ) {
    return false;
  }

  const aDeps = a.dependencies || {};
  const bDeps = b.dependencies || {};

  if (
    Object.keys(aDeps).sort().join(',') !== Object.keys(bDeps).sort().join(',')
  ) {
    return false;
  }

  for (const depName of Object.keys(aDeps)) {
    const aSubtree = aDeps[depName];
    const bSubtree = bDeps[depName];

    const isEq = depTreesEqual(aSubtree, bSubtree);
    if (!isEq) {
      return false;
    }
  }

  return true;
}

export const sortBy = (arr: any[], p: string) =>
  arr.slice().sort((x: any, y: any) => {
    const a = x[p];
    const b = y[p];
    if (a < b) {
      return -1;
    } else if (a > b) {
      return 1;
    } else {
      return 0;
    }
  });

export function generateLargeGraph(width: number, dependencyName = 'needle') {
  const builder = new depGraphLib.DepGraphBuilder(
    { name: 'npm' },
    { name: 'root', version: '1.2.3' },
  );
  const rootNodeId = 'root-node';

  const deepDependency = { name: dependencyName, version: '1.2.3' };

  builder.addPkgNode(deepDependency, dependencyName);
  builder.connectDep(rootNodeId, dependencyName);

  for (let j = 0; j < width; j++) {
    const shallowName = `id-${j}`;
    const shallowDependency = { name: shallowName, version: '1.2.3' };

    builder.addPkgNode(shallowDependency, shallowName);
    builder.connectDep(rootNodeId, shallowName);
    // builder.connectDep(shallowName, dependencyName);
    for (let k = 0; k < 3; k++) {
      const shallowName1 = `id-${j}-${k}`;
      const shallowDependency1 = { name: shallowName1, version: '1.2.3' };

      builder.addPkgNode(shallowDependency1, shallowName1);
      builder.connectDep(shallowName, shallowName1);
      builder.connectDep(shallowName1, dependencyName);
    }
  }

  return builder.build();
}
