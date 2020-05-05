import * as depGraphLib from '../../src';
import * as helpers from '../helpers';

test('depTree pruning works as expected with 1 top-level dep', async () => {
  const origTree = helpers.loadFixture('pruneable-tree.json');
  const depGraph = await depGraphLib.legacy.depTreeToGraph(origTree, 'maven');

  const expectedDepTree = helpers.loadFixture('pruneable-tree-pruned.json');
  const depTree = await depGraphLib.legacy.graphToDepTree(depGraph, 'maven', {
    deduplicateWithinTopLevelDeps: true,
  });

  expect(depTree.type).toEqual('maven');
  delete depTree.type;
  expect(depTree).toEqual(expectedDepTree);
});

test('depTree pruning works as expected with multi top-level deps', async () => {
  const origTree = helpers.loadFixture(
    'pruneable-tree-multi-top-level-deps.json',
  );
  const depGraph = await depGraphLib.legacy.depTreeToGraph(origTree, 'maven');

  const expectedDepTree = helpers.loadFixture(
    'pruneable-tree-multi-top-level-deps-pruned.json',
  );
  const depTree = await depGraphLib.legacy.graphToDepTree(depGraph, 'maven', {
    deduplicateWithinTopLevelDeps: true,
  });

  expect(depTree.type).toEqual('maven');
  delete depTree.type;
  expect(depTree).toEqual(expectedDepTree);
});

test('depTree is a no-op for dysmorphic trees', async () => {
  // NOTE: this package tree is "dysmorphic"
  // i.e. it has a package that appears twice in the tree
  // at the exact same version, but with slightly differently resolved
  // dependencies
  const origTree = helpers.loadFixture('simple-dep-tree.json');
  const depGraph = await depGraphLib.legacy.depTreeToGraph(origTree, 'maven');
  const depTree = await depGraphLib.legacy.graphToDepTree(depGraph, 'maven', {
    deduplicateWithinTopLevelDeps: true,
  });

  expect(depTree.type).toEqual('maven');
  delete depTree.type;
  expect(depTree).toEqual(origTree);
});

test('subdeps from different direct deps are not deduped', async () => {
  const origTree = helpers.loadFixture('unpruneable-tree.json');
  const depGraph = await depGraphLib.legacy.depTreeToGraph(origTree, 'maven');
  const depTree = await depGraphLib.legacy.graphToDepTree(depGraph, 'maven', {
    deduplicateWithinTopLevelDeps: true,
  });

  expect(depTree.type).toEqual('maven');
  delete depTree.type;
  expect(depTree).toEqual(origTree);
});
