import * as _ from 'lodash';
import * as depGraphLib from '../../src';

import * as helpers from '../helpers';

describe('fromJSON simple', () => {
  const simpleGraphJson = helpers.loadFixture('simple-graph.json');
  const graph = depGraphLib.createFromJSON(simpleGraphJson);

  test('basic properties', async () => {
    expect(graph.pkgManager.name).toBe('maven');

    expect(graph.rootPkg).toEqual({
      name: 'root',
      version: '0.0.0',
    });

  });

  test('getPkgs', async () => {
    expect(graph.getPkgs().sort(helpers.depSort)).toEqual([
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
      { name: 'c', version: '1.0.0' },
      { name: 'd', version: '0.0.1' },
      { name: 'd', version: '0.0.2' },
      { name: 'e', version: '5.0.0' },
      { name: 'root', version: '0.0.0' },
    ].sort(helpers.depSort));
  });

  test('getPathsToRoot', async () => {
    expect(graph.pkgPathsToRoot({ name: 'd', version: '0.0.1' })).toHaveLength(1);
    expect(graph.countPathsToRoot({ name: 'd', version: '0.0.1' })).toBe(1);

    expect(graph.pkgPathsToRoot({ name: 'd', version: '0.0.2' })).toHaveLength(1);
    expect(graph.countPathsToRoot({ name: 'd', version: '0.0.2' })).toBe(1);

    expect(graph.pkgPathsToRoot({ name: 'c', version: '1.0.0' })).toHaveLength(2);
    expect(graph.countPathsToRoot({ name: 'c', version: '1.0.0' })).toBe(2);

    expect(graph.pkgPathsToRoot({ name: 'e', version: '5.0.0' })).toHaveLength(2);
    expect(graph.countPathsToRoot({ name: 'e', version: '5.0.0' })).toBe(2);

    expect(graph.pkgPathsToRoot({ name: 'e', version: '5.0.0' })).toEqual([
      [
        { name: 'e', version: '5.0.0' },
        { name: 'd', version: '0.0.1' }, // note: d@0.0.1 from c@1.0.0
        { name: 'c', version: '1.0.0' },
        { name: 'a', version: '1.0.0' },
        { name: 'root', version: '0.0.0' },
      ],
      [
        { name: 'e', version: '5.0.0' },
        { name: 'd', version: '0.0.2' }, // note: d@0.0.2 from c@1.0.0
        { name: 'c', version: '1.0.0' },
        { name: 'b', version: '1.0.0' },
        { name: 'root', version: '0.0.0' },
      ],
    ]);
  });
});

test('fromJSON with pkgManager.repositories', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'deb',
      repositories: [
        {
          alias: 'ubuntu:18.04',
        },
      ],
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
      ],
    },
  };

  const graph = depGraphLib.createFromJSON(graphJson);
  expect(graph.pkgManager.repositories).toEqual([{ alias: 'ubuntu:18.04' }]);
});

test('fromJSON a pkg and a node share same id', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@2' },
          ],
        },
        {
          nodeId: 'foo@2',
          pkgId: 'foo@2',
          deps: [],
        },
      ],
    },
  };

  const depGraph = depGraphLib.createFromJSON(graphJson);

  expect(depGraph.getPkgs().sort()).toEqual([
    { name: 'toor', version: '1.0.0' },
    { name: 'foo', version: '2' },
  ].sort());

  expect(depGraph.pkgPathsToRoot({ name: 'foo', version: '2' })).toEqual([[
    { name: 'foo', version: '2' },
    { name: 'toor', version: '1.0.0' },
  ]]);
  expect(depGraph.countPathsToRoot({ name: 'foo', version: '2' })).toBe(1);
});

test('fromJSON no deps', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [],
        },
      ],
    },
  };

  const depGraph = depGraphLib.createFromJSON(graphJson);

  expect(depGraph.rootPkg).toEqual({ name: 'toor', version: '1.0.0' });
  expect(depGraph.getPkgs()).toEqual([{ name: 'toor', version: '1.0.0' }]);
  expect(depGraph.pkgManager.name).toEqual('pip');
});

test('fromJSON inside schemaVersion', async () => {
  const graphJson: depGraphLib.DepGraphData = helpers.loadFixture('simple-graph.json');

  graphJson.schemaVersion = '1.9.9';

  const depGraph = depGraphLib.createFromJSON(graphJson);
  expect(depGraph.getPkgs()).toHaveLength(7);
});

test('fromJSON too old schemaVersion', async () => {
  const graphJson: depGraphLib.DepGraphData = helpers.loadFixture('simple-graph.json');

  graphJson.schemaVersion = '0.0.1';

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/schemaVersion/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON too new schemaVersion', async () => {
  const graphJson: depGraphLib.DepGraphData = helpers.loadFixture('simple-graph.json');

  graphJson.schemaVersion = '2.0.0';

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/schemaVersion/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON missing root', async () => {
  const graphJson: depGraphLib.DepGraphData = helpers.loadFixture('simple-graph.json');

  graphJson.graph.nodes = graphJson.graph.nodes.map((x) => {
    if (x.nodeId === 'root-node') {
      x.nodeId = 'root-not-named-correctly';
    }
    return x;
  });

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/root/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON missing pkgManager.name', async () => {
  const graphJson: depGraphLib.DepGraphData = helpers.loadFixture('simple-graph.json');

  delete graphJson.pkgManager.name;

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/pkgManager\.name/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON missing pkgManager', async () => {
  const graphJson: depGraphLib.DepGraphData = helpers.loadFixture('simple-graph.json');

  delete graphJson.pkgManager;

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/pkgManager/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON root pkg id doesnt match name@version', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'rooty', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'rooty',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/name@version/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON with a cycle', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
      { id: 'bar@3', info: { name: 'bar', version: '3' } },
      { id: 'baz@4', info: { name: 'baz', version: '4' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [
            { nodeId: 'bar@3|x' },
          ],
        },
        {
          nodeId: 'bar@3|x',
          pkgId: 'bar@3',
          deps: [
            { nodeId: 'baz@4|x' },
          ],
        },
        {
          nodeId: 'baz@4|x',
          pkgId: 'baz@4',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
      ],
    },
  };

  const depGraph = depGraphLib.createFromJSON(graphJson);

  expect(depGraph.getPkgs().sort()).toEqual([
    { name: 'toor', version: '1.0.0' },
    { name: 'foo', version: '2' },
    { name: 'bar', version: '3' },
    { name: 'baz', version: '4' },
  ]);

  // const convertToDepTree = async () => depGraphLib.legacy.graphToDepTree(depGraph);
  // expect(convertToDepTree()).rejects.toThrow(/cycl/);

  const getPaths = () => depGraph.pkgPathsToRoot({ name: 'bar', version: '2' });
  expect(getPaths).toThrow(/cycl/);
});

test('fromJSON root is not really root', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
      { id: 'bar@3', info: { name: 'bar', version: '3' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
        {
          nodeId: 'bar@3|x',
          pkgId: 'bar@3',
          deps: [
            { nodeId: 'toor' },
          ],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/root/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON a pkg is not reachable from root', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
      { id: 'bar@3', info: { name: 'bar', version: '3' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
        {
          nodeId: 'bar@3|x',
          pkgId: 'bar@3',
          deps: [],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/reach/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON root is not really root', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
      { id: 'bar@3', info: { name: 'bar', version: '3' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
        {
          nodeId: 'bar@3|x',
          pkgId: 'bar@3',
          deps: [
            { nodeId: 'root' },
          ],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/root/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON a pkg without an instance', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
      { id: 'bar@3', info: { name: 'bar', version: '3' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/instance/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON an instance without a pkg', async () => {
  const graphJson = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
    ],
    graph: {
      rootNodeId: 'root-node',
      nodes: [
        {
          nodeId: 'root-node',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [
            { nodeId: 'bar@3|x' },
          ],
        },
        {
          nodeId: 'bar@3|x',
          deps: [],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON((graphJson as any) as depGraphLib.DepGraphData);
  expect(go).toThrow(/instance/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON an instance points to non-existing pkgId', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [
            { nodeId: 'bar@3|x' },
          ],
        },
        {
          nodeId: 'bar@3|x',
          pkgId: 'bar@3',
          deps: [],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/exist/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON root has several instances', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [
            { nodeId: 'bar@3|x' },
          ],
        },
        {
          nodeId: 'bar@3|x',
          pkgId: 'toor@1.0.0',
          deps: [],
        },
      ],
    },
  };

  const depGraph = depGraphLib.createFromJSON(graphJson);
  expect(depGraph.getPkgs().sort()).toEqual([
    {name: 'toor', version: '1.0.0'},
    {name: 'foo', version: '2'},
  ].sort());
  expect(depGraph.countPathsToRoot({name: 'toor', version: '1.0.0'})).toBe(2);
});

test('fromJSON a pkg missing info field', async () => {
  const graphJson = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2'},
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON((graphJson as any) as depGraphLib.DepGraphData);
  expect(go).toThrow(/\.info/);
  expect(go).toThrow(/^((?!(of undefined)).)*$/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON a pkg missing name field', async () => {
  const graphJson = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { version: '2' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON((graphJson as any) as depGraphLib.DepGraphData);
  expect(go).toThrow(/name/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON a pkg missing version field', async () => {
  const graphJson = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@', info: { name: 'foo' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@|x' },
          ],
        },
        {
          nodeId: 'foo@|x',
          pkgId: 'foo@',
          deps: [],
        },
      ],
    },
  };

  const depGraph = depGraphLib.createFromJSON(graphJson as any);
  expect(depGraph.getPkgs().sort()).toEqual([
    { name: 'toor', version: '1.0.0' },
    { name: 'foo', version: null },
  ]);
});

test('fromJSON pkg-id is not name@version', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@3', info: { name: 'foo', version: '2' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@3|x' },
          ],
        },
        {
          nodeId: 'foo@3|x',
          pkgId: 'foo@3',
          deps: [],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/name/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON duplicate node-id', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/node.*same id/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON duplicate pkg-id', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [
      { id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
      { id: 'foo@2', info: { name: 'foo', version: '2' } },
    ],
    graph: {
      rootNodeId: 'toor',
      nodes: [
        {
          nodeId: 'toor',
          pkgId: 'toor@1.0.0',
          deps: [
            { nodeId: 'foo@2|x' },
          ],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/pkg.*same id/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});
