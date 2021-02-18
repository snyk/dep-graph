import * as depGraphLib from '../../src';
import * as helpers from '../helpers';

describe('prune-graph', () => {
  it('pruneable-graph', () =>
    verifyPruneGraph('pruneable-graph.json', 'pruneable-graph-pruned.json'));

  it('pruneable-graph-multi-top-level-deps', () =>
    verifyPruneGraph(
      'pruneable-graph-multi-top-level-deps.json',
      'pruneable-graph-multi-top-level-deps-pruned.json',
    ));

  describe('cyclic graphs', () => {
    let depGraph;
    let cyclicDepGraphData;

    beforeEach(() => {
      cyclicDepGraphData = helpers.loadFixture('cyclic-dep-graph.json');
    });

    it('should not throw for cyclic graphs', () => {
      depGraph = depGraphLib.createFromJSON(cyclicDepGraphData);
      expect(() => depGraphLib.pruneGraph(depGraph)).not.toThrow();
    });

    it('should work for cyclic graphs', () => {
      cyclicDepGraphData.graph.nodes
        .find((x) => x.nodeId === 'toor')
        .deps.push({ nodeId: 'bar@3|x' });
      cyclicDepGraphData.graph.nodes
        .find((x) => x.nodeId === 'foo@2|x')
        .deps.push({ nodeId: 'baz@4|x' });
      depGraph = depGraphLib.createFromJSON(cyclicDepGraphData);
      const depGraph1 = depGraphLib.pruneGraph(depGraph);
      expect(() => depGraph1).not.toThrow();
    });
  });
});

function verifyPruneGraph(depGraphPath: string, prunedDepGraphPath: string) {
  const depGraph = depGraphLib.createFromJSON(
    helpers.loadFixture(depGraphPath),
  );
  const prunedGraph = depGraphLib.pruneGraph(depGraph);

  const expectedPrunedDepGraph = helpers.loadFixture(prunedDepGraphPath);

  expect(prunedGraph.toJSON()).toStrictEqual(expectedPrunedDepGraph);
}
