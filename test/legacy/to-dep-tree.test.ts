import * as depGraphLib from '../../src';
import * as helpers from '../helpers';

describe('dep-trees survive serialisation through dep-graphs', () => {
  const depTreeFixtures: Array<{
    description: string;
    path: string;
    pkgManagerName: string; // the caller will provide for tree -> graph
    pkgType: string; // the caller will provide for graph -> tree
  }> = [
    {
      description: 'goof',
      path: 'goof-dep-tree.json',
      pkgManagerName: 'npm',
      pkgType: 'npm',
    },
    {
      description: 'simple dep-tree',
      path: 'simple-dep-tree.json',
      pkgManagerName: 'maven',
      pkgType: 'maven',
    },
    {
      description: 'os dep-tree (apk)',
      path: 'os-apk-dep-tree.json',
      pkgManagerName: 'apk',
      pkgType: 'apk',
    },
    {
      description: 'os dep-tree (apt)',
      path: 'os-apt-dep-tree.json',
      pkgManagerName: 'apt',
      pkgType: 'apt',
    },
    {
      description: 'os dep-tree (deb)',
      path: 'os-deb-dep-tree.json',
      pkgManagerName: 'deb',
      pkgType: 'deb',
    },
    {
      description: 'os dep-tree (rpm)',
      path: 'os-rpm-dep-tree.json',
      pkgManagerName: 'rpm',
      pkgType: 'rpm',
    },
    {
      description: 'os dep-tree (linux - scratch image)',
      path: 'os-linux-scratch-dep-tree.json',
      pkgManagerName: 'linux',
      pkgType: 'linux',
    },
    {
      description: 'maven dep-tree',
      path: 'maven-dep-tree.json',
      pkgManagerName: 'maven',
      pkgType: 'maven',
    },
    {
      description:
        'maven dep-tree different version provenance for same package',
      path: 'maven-dep-tree-wonky.json',
      pkgManagerName: 'maven',
      pkgType: 'maven',
    },
    {
      description: 'sbt dep-tree',
      path: 'sbt-dep-tree.json',
      pkgManagerName: 'sbt',
      pkgType: 'maven',
    },
    {
      description: 'gradle dep-tree',
      path: 'gradle-dep-tree.json',
      pkgManagerName: 'gradle',
      pkgType: 'maven',
    },
    {
      description: 'pip dep-tree',
      path: 'pip-dep-tree.json',
      pkgManagerName: 'pip',
      pkgType: 'pip',
    },
    {
      description: 'yarn dep-tree',
      path: 'yarn-dep-tree.json',
      pkgManagerName: 'yarn',
      pkgType: 'npm',
    },
    {
      description: 'npm dep-tree',
      path: 'npm-dep-tree.json',
      pkgManagerName: 'npm',
      pkgType: 'npm',
    },
    {
      description: 'dep-tree different labels for same package',
      path: 'labelled-dep-tree.json',
      pkgManagerName: 'maven',
      pkgType: 'maven',
    },
  ];

  // Recursively delete named properties and properties pointing to
  // empty objects
  function cleanDepTree(tree: any, keys: string[]): void {
    for (const k of Object.keys(tree)) {
      if (keys.indexOf(k) !== -1) {
        delete tree[k];
      } else if (typeof tree[k] === 'object') {
        if (Object.keys(tree[k]).length === 0) {
          delete tree[k];
        } else {
          cleanDepTree(tree[k], keys);
        }
      }
    }
  }

  for (const fixture of depTreeFixtures) {
    test(fixture.description, async () => {
      const inputTree = helpers.loadFixture(fixture.path);
      const inputGraph = await depGraphLib.legacy.depTreeToGraph(
        inputTree,
        fixture.pkgManagerName,
      );
      const inputJSON = JSON.stringify(inputGraph);
      const outputJSON = JSON.parse(inputJSON);
      const outputGraph = depGraphLib.createFromJSON(outputJSON);
      const outputTree = await depGraphLib.legacy.graphToDepTree(
        outputGraph,
        fixture.pkgType,
      );

      expect(outputTree.type).toEqual(fixture.pkgManagerName);
      if (!inputTree.type) {
        delete outputTree.type;
      }

      cleanDepTree(inputTree, ['modules']);

      expect(outputTree).toEqual(inputTree);
    });
  }
});

test('graphToDepTree simple dysmorphic', async () => {
  // NOTE: this package tree is "dysmorphic"
  // i.e. it has a package that appears twice in the tree
  // at the exact same version, but with slightly differently resolved
  // dependencies
  const depGraphData = helpers.loadFixture('simple-graph.json');
  const depGraph = depGraphLib.createFromJSON(depGraphData);
  const expectedDepTree = helpers.loadFixture('simple-dep-tree.json');

  const depTree = await depGraphLib.legacy.graphToDepTree(depGraph, 'maven');
  expect(depTree.type).toEqual('maven');
  delete depTree.type;
  expect(depTree).toEqual(expectedDepTree);
});

test('graphToDepTree labelled dysmorphic', async () => {
  // NOTE: this package tree is "dysmorphic"
  // i.e. it has a package that appears twice in the tree
  // at the exact same version, but with slightly different labels
  const depGraphData = helpers.loadFixture('labelled-graph.json');
  const depGraph = depGraphLib.createFromJSON(depGraphData);
  const expectedDepTree = helpers.loadFixture('labelled-dep-tree.json');

  const depTree = await depGraphLib.legacy.graphToDepTree(depGraph, 'maven');
  expect(depTree.type).toEqual('maven');
  delete depTree.type;
  expect(depTree).toEqual(expectedDepTree);
});

describe('graphToDepTree with a linux pkgManager', () => {
  test('creates the correct .targetOS', async () => {
    const depGraphData = helpers.loadFixture('os-deb-graph.json');
    const depGraph = depGraphLib.createFromJSON(depGraphData);
    const expectedDepTree = helpers.loadFixture('os-deb-dep-tree.json');

    const depTree = await depGraphLib.legacy.graphToDepTree(depGraph, 'deb');

    expect(depTree.type).toEqual('deb');
    delete depTree.type;
    expect(depTree).toEqual(expectedDepTree);
  });

  describe('errors with an incomplete pkgManager', () => {
    test('missing repositories', async () => {
      const depGraphData = helpers.loadFixture('os-deb-graph.json');
      const depGraph = depGraphLib.createFromJSON(depGraphData);
      delete depGraph.pkgManager.repositories;

      await expect(
        depGraphLib.legacy.graphToDepTree(depGraph, 'deb'),
      ).rejects.toThrow('Incomplete .pkgManager, could not create .targetOS');
    });

    test('missing repository alias', async () => {
      const depGraphData = helpers.loadFixture('os-deb-graph.json');
      const depGraph = depGraphLib.createFromJSON(depGraphData);
      // @ts-expect-error: We're asserting that when used in an untyped
      // codebase, this correctly throws. In a typed codebase we can rely on
      // the compiler catching missing properties
      delete depGraph.pkgManager.repositories![0].alias;

      await expect(
        depGraphLib.legacy.graphToDepTree(depGraph, 'deb'),
      ).rejects.toThrow('Incomplete .pkgManager, could not create .targetOS');
    });
  });
});

test('graphs with cycles are supported', async () => {
  const cyclicDepGraphData = helpers.loadFixture(
    'cyclic-complex-dep-graph.json',
  );
  const cyclicDepGraph = depGraphLib.createFromJSON(cyclicDepGraphData);

  const depTree = await depGraphLib.legacy.graphToDepTree(
    cyclicDepGraph,
    'pip',
  );
  expect(depTree).toMatchSnapshot();
  expect(depTree.dependencies!.b!.dependencies!.e).toBe(
    depTree.dependencies!.c!.dependencies!.e,
  );
});
