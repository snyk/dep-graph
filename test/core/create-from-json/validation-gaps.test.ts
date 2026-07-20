import * as depGraphLib from '../../../src';

import { createDiamondGraphData } from './support/graph-data';

describe('createFromJSON validation characterization', () => {
  test('rejects an empty package manager name', () => {
    const graphData = createDiamondGraphData();
    graphData.pkgManager.name = '';

    expect(() => depGraphLib.createFromJSON(graphData)).toThrow(
      depGraphLib.Errors.ValidationError,
    );
    expect(() => depGraphLib.createFromJSON(graphData)).toThrow(
      /pkgManager\.name/,
    );
  });

  test('rejects an empty package name', () => {
    const graphData = createDiamondGraphData();
    graphData.pkgs[1] = {
      id: '@2.0.0',
      info: { name: '', version: '2.0.0' },
    };
    graphData.graph.nodes[1].pkgId = '@2.0.0';

    expect(() => depGraphLib.createFromJSON(graphData)).toThrow(
      depGraphLib.Errors.ValidationError,
    );
    expect(() => depGraphLib.createFromJSON(graphData)).toThrow(/name/);
  });

  test('rejects a root node that references an undeclared package', () => {
    const graphData = createDiamondGraphData();
    graphData.graph.nodes[0].pkgId = 'missing@1.0.0';

    expect(() => depGraphLib.createFromJSON(graphData)).toThrow(
      depGraphLib.Errors.ValidationError,
    );
    expect(() => depGraphLib.createFromJSON(graphData)).toThrow(/exist/);
  });
});
