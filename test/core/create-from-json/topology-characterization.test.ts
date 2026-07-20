import * as depGraphLib from '../../../src';

import { createDiamondGraphData, getGraphNode } from './support/graph-data';

describe('createFromJSON topology characterization', () => {
  test('preserves both paths through a diamond', () => {
    const graph = depGraphLib.createFromJSON(createDiamondGraphData());

    expect(graph.countPathsToRoot({ name: 'shared', version: '4.0.0' })).toBe(
      2,
    );
    expect(
      graph
        .directDepsLeadingTo({ name: 'shared', version: '4.0.0' })
        .map((pkg) => pkg.name)
        .sort(),
    ).toStrictEqual(['left', 'right']);
  });

  test('deduplicates repeated edges', () => {
    const graphData = createDiamondGraphData();
    const root = getGraphNode(graphData, graphData.graph.rootNodeId);
    root.deps.push({ nodeId: 'left-node' });

    const output = depGraphLib.createFromJSON(graphData).toJSON();
    const rootJson = getGraphNode(output, 'root-node');

    expect(rootJson.deps).toStrictEqual([
      { nodeId: 'left-node' },
      { nodeId: 'right-node' },
    ]);
  });

  test('accepts a self-cycle below the root', () => {
    const graphData = createDiamondGraphData();
    const shared = getGraphNode(graphData, 'shared-node');
    shared.deps.push({ nodeId: 'shared-node' });

    const graph = depGraphLib.createFromJSON(graphData);

    expect(graph.countPathsToRoot({ name: 'shared', version: '4.0.0' })).toBe(
      2,
    );
  });
});
