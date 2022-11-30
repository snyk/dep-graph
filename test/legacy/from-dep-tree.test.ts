import * as depGraphLib from '../../src';
import * as types from '../../src/core/types';
import * as helpers from '../helpers';

describe('depTreeToGraph simple dysmorphic', () => {
  // NOTE: this package tree is "dysmorphic"
  // i.e. it has a package that appears twice in the tree
  // at the exact same version, but with slightly differently resolved
  // dependencies
  const simpleDepTree = helpers.loadFixture('simple-dep-tree.json');
  const expectedGraph = helpers.loadFixture('simple-graph.json');
  expectedGraph.schemaVersion = expect.any(String);

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
    helpers.expectSamePkgs(depGraph.getPkgs(), [
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
      { name: 'c', version: '1.0.0' },
      { name: 'd', version: '0.0.1' },
      { name: 'd', version: '0.0.2' },
      { name: 'e', version: '5.0.0' },
      { name: 'root', version: '0.0.0' },
    ]);
    helpers.expectSamePkgs(depGraph.getDepPkgs(), [
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
      { name: 'c', version: '1.0.0' },
      { name: 'd', version: '0.0.1' },
      { name: 'd', version: '0.0.2' },
      { name: 'e', version: '5.0.0' },
    ]);
  });

  test('getPathsToRoot', async () => {
    expect(
      depGraph.pkgPathsToRoot({ name: 'd', version: '0.0.1' }),
    ).toHaveLength(1);
    expect(depGraph.countPathsToRoot({ name: 'd', version: '0.0.1' })).toBe(1);

    expect(
      depGraph.pkgPathsToRoot({ name: 'd', version: '0.0.2' }),
    ).toHaveLength(1);
    expect(depGraph.countPathsToRoot({ name: 'd', version: '0.0.2' })).toBe(1);

    expect(
      depGraph.pkgPathsToRoot({ name: 'c', version: '1.0.0' }),
    ).toHaveLength(2);
    expect(depGraph.countPathsToRoot({ name: 'c', version: '1.0.0' })).toBe(2);

    expect(
      depGraph.pkgPathsToRoot({ name: 'e', version: '5.0.0' }),
    ).toHaveLength(2);
    expect(depGraph.countPathsToRoot({ name: 'e', version: '5.0.0' })).toBe(2);

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
    const restoredDepTree = await depGraphLib.legacy.graphToDepTree(
      depGraph,
      'mvn',
    );
    expect(helpers.depTreesEqual(restoredDepTree, simpleDepTree)).toBe(true);
  });

  test('compare to expected graph json', async () => {
    expect(depGraph.toJSON()).toEqual(expectedGraph);
  });
});

describe('depTreeToGraph with .targetOS', () => {
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
      repositories: [{ alias: 'ubuntu:18.04' }],
    });
  });
});

describe('depTreeToGraph 0 deps', () => {
  const depTree = {
    name: 'desert',
    version: '2048',
  };

  test('create', async () => {
    const depGraph = await depGraphLib.legacy.depTreeToGraph(depTree, 'npm');

    expect(depGraph.getPkgs()).toHaveLength(1);
    expect(depGraph.getDepPkgs()).toHaveLength(0);
  });
});

describe('depTreeToGraph goof', () => {
  const depTree = helpers.loadFixture('goof-dep-tree.json');
  const expectedGraph = helpers.loadFixture('goof-graph.json');
  expectedGraph.schemaVersion = expect.any(String);

  let depGraph: types.DepGraph;
  test('create', async () => {
    depGraph = await depGraphLib.legacy.depTreeToGraph(depTree, 'npm');

    expect(depGraph.getPkgs()).toHaveLength(439);
    expect(depGraph.getDepPkgs()).toHaveLength(438);
  });

  test('check nodes', async () => {
    const depGraphInternal = depGraph as types.DepGraphInternal;

    const stripAnsiPkg = { name: 'strip-ansi', version: '3.0.1' };
    const stripAnsiNodes = depGraphInternal.getPkgNodeIds(stripAnsiPkg);
    expect(stripAnsiNodes).toHaveLength(2);

    const stripAnsiPaths = depGraph.pkgPathsToRoot(stripAnsiPkg);
    expect(stripAnsiPaths).toHaveLength(6);
    expect(depGraph.countPathsToRoot(stripAnsiPkg)).toBe(6);

    expect(
      depGraph.pkgPathsToRoot({ name: 'ansi-regex', version: '2.0.0' }),
    ).toHaveLength(4);
    expect(
      depGraph.countPathsToRoot({ name: 'ansi-regex', version: '2.0.0' }),
    ).toBe(4);
    expect(
      depGraph.pkgPathsToRoot({ name: 'ansi-regex', version: '2.1.1' }),
    ).toHaveLength(3);
    expect(
      depGraph.countPathsToRoot({ name: 'ansi-regex', version: '2.1.1' }),
    ).toBe(3);
    expect(
      depGraph.pkgPathsToRoot({ name: 'wrappy', version: '1.0.2' }),
    ).toHaveLength(22);
    expect(
      depGraph.countPathsToRoot({ name: 'wrappy', version: '1.0.2' }),
    ).toBe(22);

    const expressNodes = depGraphInternal.getPkgNodeIds({
      name: 'express',
      version: '4.12.4',
    });
    expect(expressNodes).toHaveLength(1);
  });

  test('count paths to root', async () => {
    for (const pkg of depGraph.getPkgs()) {
      const firstResult = depGraph.countPathsToRoot(pkg);
      const secondResult = depGraph.countPathsToRoot(pkg);
      expect(secondResult).toEqual(firstResult);
      expect(secondResult).toEqual(depGraph.pkgPathsToRoot(pkg).length);
    }
  });

  test('compare to expected fixture', async () => {
    expect(depGraph.toJSON()).toEqual(expectedGraph);
  });
});

describe('depTreeToGraph with pkg that that misses a version', () => {
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
    expect(depGraph.getDepPkgs()).toHaveLength(2);

    const depGraphInternal = depGraph as types.DepGraphInternal;
    expect(depGraphInternal.getPkgNodeIds({ name: 'bar' } as any)).toEqual([
      'bar@',
    ]);
  });
});

describe('depTreeToGraph with funky pipes in the version', () => {
  const depTree = {
    name: 'oak',
    version: '1.0',
    dependencies: {
      foo: {
        version: '2|3',
      },
      bar: {
        version: '1',
        dependencies: {
          foo: {
            version: '2|4',
          },
        },
      },
    },
  };

  let depGraph: types.DepGraph;
  test('create', async () => {
    depGraph = await depGraphLib.legacy.depTreeToGraph(depTree, 'composer');
    expect(depGraph.getPkgs()).toHaveLength(4);
    expect(depGraph.getDepPkgs()).toHaveLength(3);
  });

  test('convert to JSON and back', async () => {
    const graphJson = depGraph.toJSON();
    const restoredGraph = await depGraphLib.createFromJSON(graphJson);

    helpers.expectSamePkgs(restoredGraph.getPkgs(), depGraph.getPkgs());
    helpers.expectSamePkgs(restoredGraph.getDepPkgs(), depGraph.getDepPkgs());
  });
});

describe('depTreeToGraph with purl', () => {
  const depTree = {
    name: 'oak',
    version: '1.0',
    purl: 'pkg:deb/oak@1.0',
    dependencies: {
      foo: {
        version: 'v2.3.0',
        purl: 'pkg:deb/foo@v2.3.0',
      },
      bar: {
        version: '1',
        purl: 'pkg:dep/bar@1',
        dependencies: {
          foo: {
            version: 'v2.4.0',
            purl: 'pkg:deb/foo@v2.4.0',
          },
        },
      },
    },
  };

  let depGraph: types.DepGraph;
  test('create', async () => {
    depGraph = await depGraphLib.legacy.depTreeToGraph(depTree, 'deb');
    expect(depGraph.getPkgs()).toHaveLength(4);
    expect(depGraph.getDepPkgs()).toHaveLength(3);
    depGraph.getPkgs().forEach((pkg) => expect(pkg.purl).toBeDefined());
  });

  test('convert to JSON and back', async () => {
    const graphJson = depGraph.toJSON();
    const restoredGraph = await depGraphLib.createFromJSON(graphJson);

    helpers.expectSamePkgs(restoredGraph.getPkgs(), depGraph.getPkgs());
    helpers.expectSamePkgs(restoredGraph.getDepPkgs(), depGraph.getDepPkgs());
  });
});

describe('depTreeToGraph cycle with root', () => {
  const depTree = {
    name: 'maple',
    version: '3',
    dependencies: {
      foo: {
        version: '2',
      },
      bar: {
        version: '1',
        dependencies: {
          maple: {
            version: '3',
          },
        },
      },
    },
  };

  let depGraph: types.DepGraph;
  test('create', async () => {
    depGraph = await depGraphLib.legacy.depTreeToGraph(depTree, 'composer');
    expect(depGraph.getPkgs()).toHaveLength(3);
    // note that despite maple@3 being a dependency of bar@1,
    //   it's still not returned, as it's the root package.
    expect(depGraph.getDepPkgs()).toEqual([
      { name: 'bar', version: '1' },
      { name: 'foo', version: '2' },
    ]);

    expect(depGraph.countPathsToRoot(depGraph.rootPkg)).toBe(2);
    expect(depGraph.pkgPathsToRoot(depGraph.rootPkg)).toEqual([
      [{ name: 'maple', version: '3' }],
      [
        { name: 'maple', version: '3' },
        { name: 'bar', version: '1' },
        { name: 'maple', version: '3' },
      ],
    ]);
  });

  test('convert to JSON and back', async () => {
    const graphJson = depGraph.toJSON();
    const restoredGraph = await depGraphLib.createFromJSON(graphJson);

    expect(restoredGraph.getPkgs().sort()).toEqual(depGraph.getPkgs().sort());
    expect(restoredGraph.getDepPkgs().sort()).toEqual(
      depGraph.getDepPkgs().sort(),
    );
  });
});

describe('depTreeToGraph cycle with labels', () => {
  test('npm', async () => {
    const depTree = helpers.loadFixture('npm-cyclic-dep-tree.json');
    const depGraph = await depGraphLib.legacy.depTreeToGraph(depTree, 'npm');
    expect(
      (await depGraphLib.legacy.graphToDepTree(depGraph, 'npm')).dependencies,
    ).toEqual(depTree.dependencies);
  });
});

describe('depTreeToGraph with (invalid) null dependency', () => {
  const depTree = {
    name: 'pine',
    version: '4',
    dependencies: {
      foo: {
        version: '1',
      },
      bar: null,
      baz: {
        version: '3',
      },
    },
  };

  let depGraph: types.DepGraph;
  test('create', async () => {
    depGraph = await depGraphLib.legacy.depTreeToGraph(
      depTree as any,
      'composer',
    );
    helpers.expectSamePkgs(depGraph.getPkgs(), [
      { name: 'pine', version: '4' },
      { name: 'foo', version: '1' },
      { name: 'baz', version: '3' },
    ]);
    helpers.expectSamePkgs(depGraph.getDepPkgs(), [
      { name: 'foo', version: '1' },
      { name: 'baz', version: '3' },
    ]);
  });
});

describe('with versionProvenance', () => {
  let depGraph: types.DepGraph;
  let depTree: depGraphLib.legacy.DepTree;

  beforeAll(async () => {
    depTree = helpers.loadFixture('maven-dep-tree.json');
    depGraph = await depGraphLib.legacy.depTreeToGraph(depTree, 'maven');
  });

  it('matches snapshot', () => {
    expect(depGraph.toJSON()).toMatchSnapshot({
      schemaVersion: expect.any(String),
    });
  });

  it('equals orig depTree when converted back', async () => {
    const restoredDepTree = await depGraphLib.legacy.graphToDepTree(
      depGraph,
      'maven',
    );
    expect(helpers.depTreesEqual(restoredDepTree, depTree)).toBeTruthy();
  });

  it('getPkgNodes() returns versionProvenance', () => {
    const commonsIoNodes = depGraph.getPkgNodes({
      name: 'commons-io:commons-io',
      version: '2.2',
    });
    expect(commonsIoNodes[0].info.versionProvenance!.type).toEqual(
      'dependencyManagement',
    );

    const ognlNodes = depGraph.getPkgNodes({
      name: 'ognl:ognl',
      version: '3.0.6',
    });
    expect(ognlNodes[0].info.versionProvenance).toEqual({
      type: 'property',
      property: { name: 'ognl.version' },
      // tslint:disable:max-line-length
      location:
        'https://maven-central.storage-download.googleapis.com/repos/central/data/org/apache/struts/struts2-parent/2.3.20/struts2-parent-2.3.20.pom',
    });
  });
});

describe('without versionProvenance', () => {
  let depGraph: types.DepGraph;

  beforeAll(async () => {
    const depTree = helpers.loadFixture('goof-dep-tree.json');
    depGraph = await depGraphLib.legacy.depTreeToGraph(depTree, 'npm');
  });

  it('matches snapshot', () => {
    expect(depGraph.toJSON()).toMatchSnapshot({
      schemaVersion: expect.any(String),
    });
  });
});

describe('with labels', () => {
  let depGraph: types.DepGraph;
  let depTree: depGraphLib.legacy.DepTree;

  beforeAll(async () => {
    depTree = helpers.loadFixture('labelled-dep-tree.json');
    depGraph = await depGraphLib.legacy.depTreeToGraph(depTree, 'maven');
  });

  it('matches snapshot', () => {
    expect(depGraph.toJSON()).toMatchSnapshot({
      schemaVersion: expect.any(String),
    });
  });

  it('equals orig depTree when converted back', async () => {
    const restoredDepTree = await depGraphLib.legacy.graphToDepTree(
      depGraph,
      'maven',
    );
    expect(helpers.depTreesEqual(restoredDepTree, depTree)).toBeTruthy();
  });

  it('getPkgNodes() returns labels', () => {
    let dNodes = depGraph.getPkgNodes({ name: 'd', version: '2.0.0' });
    dNodes = helpers.sortBy(dNodes, 'id');
    expect(dNodes[0].info.labels).toEqual({ key: 'value1' });
    expect(dNodes[1].info.labels).toEqual({ key: 'value2' });
  });
});
