import * as _ from 'lodash';
import * as depGraphLib from '../../src';
import * as types from '../../src/core/types';
import * as helpers from '../helpers';

const depTreesEqual = (a, b) => {
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
};

describe('createFromDepTree simple dysmorphic', () => {
  // NOTE: this package tree is "dysmorphic"
  // i.e. it has a package that appears twice in the tree
  // at the exact same version, but with slightly differently resolved
  // dependencies
  const simpleDepTree = helpers.loadFixture('simple-dep-tree.json');
  const expectedGraph = helpers.loadFixture('simple-graph.json');

  let depGraph: depGraphLib.DepGraph;
  beforeAll(async () => {
    depGraph = await depGraphLib.legacy.depTreeToGraph(simpleDepTree, 'maven');
  });

  test('basic properties', async () => {
    expect(depGraph.pkgManager.name).toEqual('maven');

    expect(depGraph.rootPkg).toEqual({
      name: 'root',
      version: '0.0.0',
    });
    expect(depGraph.pkgManager).toEqual({
      name: 'maven',
    });
  });

  test('getPkgs', async () => {
    expect(depGraph.getPkgs().sort(helpers.depSort)).toEqual([
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
      { name: 'c', version: '1.0.0' },
      { name: 'd', version: '0.0.1' },
      { name: 'd', version: '0.0.2' },
      { name: 'e', version: '5.0.0' },
      { name: 'root', version: '0.0.0' },
    ].sort(helpers.depSort));
  });

  test('getPathsToRoot', async () => {
    expect(depGraph.pkgPathsToRoot({ name: 'd', version: '0.0.1' })).toHaveLength(1);

    expect(depGraph.pkgPathsToRoot({ name: 'd', version: '0.0.2' })).toHaveLength(1);

    expect(depGraph.pkgPathsToRoot({ name: 'c', version: '1.0.0' })).toHaveLength(2);

    expect(depGraph.pkgPathsToRoot({ name: 'e', version: '5.0.0' })).toHaveLength(2);

    expect(depGraph.pkgPathsToRoot({ name: 'e', version: '5.0.0' })).toEqual([
      [
        { name: 'e', version: '5.0.0' },
        { name: 'd', version: '0.0.1' }, // note: d@0.0.1 from c@1.0.0
        { name: 'c', version: '1.0.0' },
        { name: 'a', version: '1.0.0' },
        { name: 'root', version: '0.0.0' },
      ],
      [
        { name: 'e', version: '5.0.0' },
        { name: 'd', version: '0.0.2' }, // note: d@0.0.2 from c@1.0.0
        { name: 'c', version: '1.0.0' },
        { name: 'b', version: '1.0.0' },
        { name: 'root', version: '0.0.0' },
      ],
    ]);
  });

  test('convert back to depTree & compare', async () => {
    const restoredDepTree = await helpers.graphToDepTree(depGraph);
    expect(restoredDepTree).toEqual(simpleDepTree);
  });

  test('compare to expected graph json', async () => {
    expect(depGraph.toJSON()).toEqual(expectedGraph);
  });
});

describe('createFromDepTree with .targetOS', () => {
  const osDepTree = helpers.loadFixture('simple-dep-tree.json');
  osDepTree.targetOS = {
    name: 'ubuntu',
    version: '18.04',
  };

  let depGraph: depGraphLib.DepGraph;
  beforeAll(async () => {
    depGraph = await depGraphLib.legacy.depTreeToGraph(osDepTree, 'deb');
  });

  test('pkgManager', async () => {
    expect(depGraph.pkgManager).toEqual({
      name: 'deb',
      repositories: [
        { alias: 'ubuntu:18.04' },
      ],
    });
  });
});

describe('createFromDepTree 0 deps', () => {
  const depTree = {
    name: 'desert',
    version: '2048',
  };

  test('create', async () => {
    const depGraph = await depGraphLib.legacy.depTreeToGraph(depTree, 'npm');

    expect(depGraph.getPkgs()).toHaveLength(1);
  });
});

describe('createFromDepTree goof', () => {
  const depTree = helpers.loadFixture('goof-dep-tree.json');
  const expectedGraph = helpers.loadFixture('goof-graph.json');

  let depGraph;
  test('create', async () => {
    depGraph = await depGraphLib.legacy.depTreeToGraph(depTree, 'npm');

    expect(depGraph.getPkgs()).toHaveLength(439);
  });

  test('check nodes', async () => {
    const depGraphInternal = depGraph as types.DepGraphInternal;

    const stripAnsiPkg = {name: 'strip-ansi', version: '3.0.1'};
    const stripAnsiNodes = depGraph.getPkgNodeIds(stripAnsiPkg);
    expect(stripAnsiNodes).toHaveLength(2);

    const stripAnsiPaths = depGraph.pkgPathsToRoot(stripAnsiPkg);
    expect(stripAnsiPaths).toHaveLength(6);

    expect(depGraph.pkgPathsToRoot({name: 'ansi-regex', version: '2.0.0'})).toHaveLength(4);
    expect(depGraph.pkgPathsToRoot({name: 'ansi-regex', version: '2.1.1'})).toHaveLength(3);

    const expressNodes = depGraphInternal.getPkgNodeIds({name: 'express', version: '4.12.4'});
    expect(expressNodes).toHaveLength(1);
  });

  test('compare to expected fixture', async () => {
    expect(depGraph.toJSON()).toEqual(expectedGraph);
  });
});

describe('createFromDepTree with pkg that that misses a version', () => {
  const depTree = {
    name: 'bamboo',
    version: '1.0',
    dependencies: {
      foo: {
        version: '2.0',
      },
      bar: {
        name: 'bar',
      },
    },
  };

  test('create', async () => {
    const depGraph = await depGraphLib.legacy.depTreeToGraph(depTree, 'npm');

    expect(depGraph.getPkgs()).toHaveLength(3);

    const depGraphInternal = depGraph as types.DepGraphInternal;
    expect(depGraphInternal.getPkgNodeIds({name: 'bar'} as any)).toEqual(['bar@']);
  });
});
