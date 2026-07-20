import * as depGraphLib from '../../../src';

import {
  canonicalizeDepGraphData,
  cloneDepGraphData,
} from './support/canonicalize';
import { createDiamondGraphData } from './support/graph-data';

describe('createFromJSON input ordering', () => {
  test('preserves graph semantics when input arrays are reordered', () => {
    const originalData = createDiamondGraphData();
    const reorderedData = cloneDepGraphData(originalData);
    reorderedData.pkgs.reverse();
    reorderedData.graph.nodes.reverse();
    for (const node of reorderedData.graph.nodes) {
      node.deps.reverse();
    }

    const original = depGraphLib.createFromJSON(originalData);
    const reordered = depGraphLib.createFromJSON(reorderedData);

    expect(canonicalizeDepGraphData(reordered.toJSON())).toStrictEqual(
      canonicalizeDepGraphData(original.toJSON()),
    );
    expect(reordered.equals(original)).toBe(true);
  });

  test('supports forward dependency references', () => {
    const graphData = createDiamondGraphData();
    const root = graphData.graph.nodes.shift();
    if (!root) {
      throw new Error('fixture root node is missing');
    }
    graphData.graph.nodes.push(root);

    expect(() => depGraphLib.createFromJSON(graphData)).not.toThrow();
  });
});
