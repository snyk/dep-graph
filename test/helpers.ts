import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import { PkgInfo } from '../src';

export function loadFixture(name: string) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, `fixtures/${name}`), 'utf8'));
}

function depSort(a: any, b: any) {
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
  return expect(actual.sort(depSort)).toEqual(expected.sort(depSort));
}

export function depTreesEqual(a: any, b: any) {
  if (a.name !== b.name || a.version !== b.version) {
    return false;
  }

  const aDeps = a.dependencies || {};
  const bDeps = b.dependencies || {};

  if (_.keys(aDeps).sort().join(',') !== _.keys(bDeps).sort().join(',')) {
    return false;
  }

  for (const depName of _.keys(aDeps)) {
    const aSubtree = aDeps[depName];
    const bSubtree = bDeps[depName];

    const isEq = depTreesEqual(aSubtree, bSubtree);
    if (!isEq) {
      return false;
    }
  }

  return true;
}
