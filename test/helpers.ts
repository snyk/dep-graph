import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';

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

export function depTreesEqual(a, b) {
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
