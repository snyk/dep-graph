import * as depGraphLib from '../../../src';

import { createDiamondGraphData, getGraphNode } from './support/graph-data';

describe('createFromJSON metadata', () => {
  test('preserves package manager and package metadata', () => {
    const graph = depGraphLib.createFromJSON(createDiamondGraphData());
    const json = graph.toJSON();

    expect(json.pkgManager).toStrictEqual({
      name: 'npm',
      version: '10.0.0',
      repositories: [{ alias: 'npmjs' }],
    });
    expect(json.pkgs).toContainEqual({
      id: 'shared@4.0.0',
      info: {
        name: 'shared',
        version: '4.0.0',
        purl: 'pkg:npm/shared@4.0.0',
      },
    });
  });

  test('preserves node labels and version provenance', () => {
    const graph = depGraphLib.createFromJSON(createDiamondGraphData());
    const json = graph.toJSON();

    expect(getGraphNode(json, 'root-node').info).toStrictEqual({
      labels: { scope: 'prod', source: 'manifest' },
    });
    expect(getGraphNode(json, 'left-node').info).toStrictEqual({
      versionProvenance: {
        type: 'lock-file',
        location: 'package-lock.json',
        property: { name: 'left' },
      },
    });
  });
});
