import * as depGraphLib from '../../../src';

import { createDiamondGraphData } from './support/graph-data';

/**
 * These tests document observable behavior whose desired contract is unclear.
 * Change them only alongside an explicit correctness or API decision.
 */
describe('createFromJSON ambiguous existing behavior', () => {
  test('accepts a dangling dependency but creates an unusable placeholder', () => {
    const graphData = createDiamondGraphData();
    graphData.graph.nodes[0].deps.push({ nodeId: 'missing-node' });

    const graph = depGraphLib.createFromJSON(graphData);

    expect(() => graph.toJSON()).toThrow(TypeError);
  });

  test('retains references to package metadata supplied by the caller', () => {
    const graphData = createDiamondGraphData();
    const graph = depGraphLib.createFromJSON(graphData);

    graphData.pkgs[0].info.purl = 'pkg:npm/root@mutated';

    expect(graph.rootPkg.purl).toBe('pkg:npm/root@mutated');
  });

  test('normalizes an empty package version to undefined', () => {
    const graphData = createDiamondGraphData();
    graphData.pkgs[1] = {
      id: 'left@',
      info: { name: 'left', version: '' },
    };
    graphData.graph.nodes[1].pkgId = 'left@';

    const graph = depGraphLib.createFromJSON(graphData);

    expect(graph.getPkgs()).toContainEqual({
      name: 'left',
      version: undefined,
    });
  });
});
