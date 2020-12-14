import * as depGraphLib from '../../src';
import * as helpers from '../helpers';
import { mapToNonCyclicGraph } from '../../src/legacy';
import { DepGraphInternal } from '../../src/core/types';
import { DepGraph, DepGraphData } from '../../src';

describe('mapToNonCyclicGraph', () => {
  describe('cyclic graph', () => {
    let cyclicDepGraphData: DepGraphData;
    let cyclicDepGraph: DepGraph;
    let nonCyclicDepGraph: DepGraphInternal;

    beforeEach(async () => {
      cyclicDepGraphData = helpers.loadFixture('cyclic-dep-graph.json');
      cyclicDepGraph = depGraphLib.createFromJSON(cyclicDepGraphData);

      nonCyclicDepGraph = (await depGraphLib.legacy.mapToNonCyclicGraph(
        cyclicDepGraph,
      )) as DepGraphInternal;
    });

    test('should not change original depGraph', async () => {
      const initialDepGraphData = helpers.loadFixture('cyclic-dep-graph.json');

      expect(cyclicDepGraph.toJSON()).toEqual(initialDepGraphData);
    });

    test('should return a non-cyclic graph', async () => {
      expect(nonCyclicDepGraph.hasCycles()).toBeFalsy();
    });

    test('should return a cyclic graph with "more or equal" nodes number', async () => {
      expect(nonCyclicDepGraph.getDepPkgs().length).toBeGreaterThanOrEqual(
        cyclicDepGraph.getDepPkgs().length,
      );
    });

    test('should return a non-cyclic graph - snapshot', async () => {
      expect(nonCyclicDepGraph).toMatchSnapshot();
    });
  });

  test('should return the same graph for non-cyclic graph', async () => {
    const nonCyclicDepGraphData = helpers.loadFixture('goof-graph.json');
    const cyclicDepGraph = depGraphLib.createFromJSON(nonCyclicDepGraphData);

    const resultDepGraph = (await depGraphLib.legacy.mapToNonCyclicGraph(
      cyclicDepGraph,
    )) as DepGraphInternal;
    expect(resultDepGraph).toStrictEqual(cyclicDepGraph);
  });
});
