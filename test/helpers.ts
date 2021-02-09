import * as _isEqual from 'lodash.isequal';
import * as fs from 'fs';
import * as path from 'path';
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
