import * as depGraphLib from '../../src';
import * as helpers from '../helpers';
import { createChangedPackagesGraph } from '../../src';

describe('filter-unchanged-packages', () => {
  it.each`
    fixture
    ${'equals/simple.json'}
    ${'cyclic-complex-dep-graph.json'}
    ${'goof-graph.json'}
  `(
    'result and $fixture are equals for empty initial graph',
    async ({ fixture }) => {
      const graphB = depGraphLib.createFromJSON(helpers.loadFixture(fixture));

      const graphA = new depGraphLib.DepGraphBuilder(
        graphB.pkgManager,
        graphB.rootPkg,
      ).build();

      const result = await createChangedPackagesGraph(graphA, graphB);
      expect(graphB.equals(result)).toBe(true);
    },
  );

  it.each`
    fixtureA                               | fixtureB                                                                            | expected
    ${'changed-packages-graph/graph.json'} | ${'changed-packages-graph/graph-direct-dep-added.json'}                             | ${'changed-packages-graph/graph-direct-dep-added-expected.json'}
    ${'changed-packages-graph/graph.json'} | ${'changed-packages-graph/graph-direct-dep-changed-cycle.json'}                     | ${'changed-packages-graph/graph-direct-dep-changed-cycle-expected.json'}
    ${'changed-packages-graph/graph.json'} | ${'changed-packages-graph/graph-direct-dep-changed.json'}                           | ${'changed-packages-graph/graph-direct-dep-changed-expected.json'}
    ${'changed-packages-graph/graph.json'} | ${'changed-packages-graph/graph-direct-dep-removed.json'}                           | ${'changed-packages-graph/graph-direct-dep-removed-expected.json'}
    ${'changed-packages-graph/graph.json'} | ${'changed-packages-graph/graph-direct-dep-with-exiting-transitive-dep-added.json'} | ${'changed-packages-graph/graph-direct-dep-with-exiting-transitive-dep-added-expected.json'}
    ${'changed-packages-graph/graph.json'} | ${'changed-packages-graph/graph-root-and-direct-dep-changed.json'}                  | ${'changed-packages-graph/graph-root-and-direct-dep-changed-expected.json'}
    ${'changed-packages-graph/graph.json'} | ${'changed-packages-graph/graph-root-changed-expected.json'}                        | ${'changed-packages-graph/graph-root-changed-expected.json'}
    ${'changed-packages-graph/graph.json'} | ${'changed-packages-graph/graph-transitive-dep-as-direct-dep.json'}                 | ${'changed-packages-graph/graph-transitive-dep-as-direct-dep-expected.json'}
    ${'changed-packages-graph/graph.json'} | ${'changed-packages-graph/graph-transitive-dep-changed-cycle.json'}                 | ${'changed-packages-graph/graph-transitive-dep-changed-cycle-expected.json'}
    ${'changed-packages-graph/graph.json'} | ${'changed-packages-graph/graph-transitive-dep-changed.json'}                       | ${'changed-packages-graph/graph-transitive-dep-changed-expected.json'}
    ${'changed-packages-graph/graph.json'} | ${'changed-packages-graph/graph-transitive-dep-removed.json'}                       | ${'changed-packages-graph/graph-transitive-dep-removed-expected.json'}
  `(
    'result is $expected for $fixtureA and $fixtureB',
    async ({ fixtureA, fixtureB, expected }) => {
      const graphA = depGraphLib.createFromJSON(helpers.loadFixture(fixtureA));

      const graphB = depGraphLib.createFromJSON(helpers.loadFixture(fixtureB));

      const expectedResult = depGraphLib.createFromJSON(
        helpers.loadFixture(expected),
      );

      const result = await createChangedPackagesGraph(graphA, graphB);
      expect(expectedResult.equals(result, { compareRoot: true })).toBe(true);
    },
  );
});
