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

    expect(graph.pkgPathsToRoot({ name: 'd', version: '0.0.2' })).toHaveLength(1);

    expect(graph.pkgPathsToRoot({ name: 'c', version: '1.0.0' })).toHaveLength(2);

    expect(graph.pkgPathsToRoot({ name: 'e', version: '5.0.0' })).toHaveLength(2);

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
    schemaVersion: '2.0.0',
    pkgManager: {
      name: 'deb',
      repositories: [
        {
          alias: 'ubuntu:18.04',
        },
      ],
    },
    pkgs: {
      'root': { name: 'app', version: '1.0.0' },
      'foo@2': { name: 'foo', version: '2' },
    },
    graph: {
      'root': {
        pkgId: 'root',
        deps: [
          { nodeId: 'foo@2|x' },
        ],
      },
      'foo@2|x': {
        pkgId: 'foo@2',
        deps: [],
      },
    },
  };

  const graph = depGraphLib.createFromJSON(graphJson);
  expect(graph.pkgManager.repositories).toEqual([{ alias: 'ubuntu:18.04' }]);
});

test('fromJSON a pkg and a node share same id', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '2.0.0',
    pkgManager: { name: 'pip' },
    pkgs: {
      'root': { name: 'app', version: '1.0.0' },
      'foo@2': { name: 'foo', version: '2' },
    },
    graph: {
      'root': {
        pkgId: 'root',
        deps: [
          { nodeId: 'foo@2' },
        ],
      },
      'foo@2': {
        pkgId: 'foo@2',
        deps: [],
      },
    },
  };

  const depGraph = depGraphLib.createFromJSON(graphJson);

  expect(depGraph.getPkgs().sort()).toEqual([
    { name: 'app', version: '1.0.0' },
    { name: 'foo', version: '2' },
  ].sort());

  expect(depGraph.pkgPathsToRoot({ name: 'foo', version: '2' })).toEqual([[
    { name: 'foo', version: '2' },
    { name: 'app', version: '1.0.0' },
  ]]);
});

test('fromJSON no deps', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '2.0.0',
    pkgManager: { name: 'pip' },
    pkgs: {
      root: { name: 'app', version: '1.0.0' },
    },
    graph: {
      root: {
        pkgId: 'root',
        deps: [],
      },
    },
  };

  const depGraph = depGraphLib.createFromJSON(graphJson);

  expect(depGraph.rootPkg).toEqual({ name: 'app', version: '1.0.0' });
  expect(depGraph.getPkgs()).toEqual([{ name: 'app', version: '1.0.0' }]);
  expect(depGraph.pkgManager.name).toEqual('pip');
});

test('fromJSON inside schemaVersion', async () => {
  const graphJson: depGraphLib.DepGraphData = helpers.loadFixture('simple-graph.json');

  graphJson.schemaVersion = '2.9.9';

  const depGraph = depGraphLib.createFromJSON(graphJson);
  expect(depGraph.getPkgs()).toHaveLength(7);
});

test('fromJSON too old schemaVersion', async () => {
  const graphJson: depGraphLib.DepGraphData = helpers.loadFixture('simple-graph.json');

  graphJson.schemaVersion = '1.0.1';

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/schemaVersion/);
});

test('fromJSON too new schemaVersion', async () => {
  const graphJson: depGraphLib.DepGraphData = helpers.loadFixture('simple-graph.json');

  graphJson.schemaVersion = '3.0.0';

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/schemaVersion/);
});

test('fromJSON missing root', async () => {
  const graphJson: depGraphLib.DepGraphData = helpers.loadFixture('simple-graph.json');

  graphJson.graph.oldRoot = graphJson.graph.root;
  delete graphJson.graph.root;

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/root/);
});

test('fromJSON missing pkgManager.name', async () => {
  const graphJson: depGraphLib.DepGraphData = helpers.loadFixture('simple-graph.json');

  delete graphJson.pkgManager.name;

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/pkgManager\.name/);
});

test('fromJSON missing pkgManager', async () => {
  const graphJson: depGraphLib.DepGraphData = helpers.loadFixture('simple-graph.json');

  delete graphJson.pkgManager;

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/bad data format/);
});

test('fromJSON non-root pkg id does not match name@version', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '2.0.0',
    pkgManager: { name: 'pip' },
    pkgs: {
      root: { name: 'app', version: '1.0.0' },
      foo: { name: 'foo', version: '2' },
    },
    graph: {
      root: {
        pkgId: 'root',
        deps: [
          { nodeId: 'foo' },
        ],
      },
      foo: {
        pkgId: 'foo',
        deps: [],
      },
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/name@version/);
});

test('fromJSON with a cycle', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '2.0.0',
    pkgManager: { name: 'pip' },
    pkgs: {
      'root': { name: 'app', version: '1.0.0' },
      'foo@2': { name: 'foo', version: '2' },
      'bar@3': { name: 'bar', version: '3' },
      'baz@4': { name: 'baz', version: '4' },
    },
    graph: {
      'root': {
        pkgId: 'root',
        deps: [
          { nodeId: 'foo@2|x' },
        ],
      },
      'foo@2|x': {
        pkgId: 'foo@2',
        deps: [
          { nodeId: 'bar@3|x' },
        ],
      },
      'bar@3|x': {
        pkgId: 'bar@3',
        deps: [
          { nodeId: 'baz@4|x' },
        ],
      },
      'baz@4|x': {
        pkgId: 'baz@4',
        deps: [
          { nodeId: 'foo@2|x' },
        ],
      },
    },
  };

  const depGraph = depGraphLib.createFromJSON(graphJson);

  expect(depGraph.getPkgs().sort()).toEqual([
    { name: 'app', version: '1.0.0' },
    { name: 'foo', version: '2' },
    { name: 'bar', version: '3' },
    { name: 'baz', version: '4' },
  ]);

  // const convertToDepTree = async () => depGraphLib.legacy.graphToDepTree(depGraph);
  // expect(convertToDepTree()).rejects.toThrow(/cycl/);

  const getPaths = () => depGraph.pkgPathsToRoot({ name: 'bar', version: '2' });
  expect(getPaths).toThrow(/cycl/);
});

test('fromJSON a pkg depends on root', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '2.0.0',
    pkgManager: { name: 'pip' },
    pkgs: {
      'root': { name: 'app', version: '1.0.0' },
      'foo@2': { name: 'foo', version: '2' },
      'bar@3': { name: 'bar', version: '3' },
    },
    graph: {
      'root': {
        pkgId: 'root',
        deps: [
          { nodeId: 'foo@2|x' },
        ],
      },
      'foo@2|x': {
        pkgId: 'foo@2',
        deps: [],
      },
      'bar@3|x': {
        pkgId: 'bar@3',
        deps: [
          { nodeId: 'root' },
        ],
      },
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/root/);
});

test('fromJSON a pkg is not reachable from root', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '2.0.0',
    pkgManager: { name: 'pip' },
    pkgs: {
      'root': { name: 'app', version: '1.0.0' },
      'foo@2': { name: 'foo', version: '2' },
      'bar@3': { name: 'bar', version: '3' },
    },
    graph: {
      'root': {
        pkgId: 'root',
        deps: [
          { nodeId: 'foo@2|x' },
        ],
      },
      'foo@2|x': {
        pkgId: 'foo@2',
        deps: [],
      },
      'bar@3|x': {
        pkgId: 'bar@3',
        deps: [],
      },
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/reach/);
});

test('fromJSON a pkg without an instance', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '2.0.0',
    pkgManager: { name: 'pip' },
    pkgs: {
      'root': { name: 'app', version: '1.0.0' },
      'foo@2': { name: 'foo', version: '2' },
      'bar@3': { name: 'bar', version: '3' },
    },
    graph: {
      'root': {
        pkgId: 'root',
        deps: [
          { nodeId: 'foo@2|x' },
        ],
      },
      'foo@2|x': {
        pkgId: 'foo@2',
        deps: [],
      },
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/instance/);
});

test('fromJSON an instance points to non-existing pkgId', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '2.0.0',
    pkgManager: { name: 'pip' },
    pkgs: {
      'root': { name: 'app', version: '1.0.0' },
      'foo@2': { name: 'foo', version: '2' },
    },
    graph: {
      'root': {
        pkgId: 'root',
        deps: [
          { nodeId: 'foo@2|x' },
        ],
      },
      'foo@2|x': {
        pkgId: 'foo@2',
        deps: [
          { nodeId: 'bar@3|x' },
        ],
      },
      'bar@3|x': {
        pkgId: 'bar@3',
        deps: [],
      },
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/non-existing pkgId/);
});

test('fromJSON an empty pkg', async () => {
  const graphJson = {
    schemaVersion: '2.0.0',
    pkgManager: { name: 'pip' },
    pkgs: {
      'root': { name: 'app', version: '1.0.0' },
      'foo@2': null,
    },
    graph: {
      'root': {
        pkgId: 'root',
        deps: [
          { nodeId: 'foo@2|x' },
        ],
      },
      'foo@2|x': {
        pkgId: 'foo@2',
        deps: [],
      },
    },
  };

  const go = () => depGraphLib.createFromJSON((graphJson as any) as depGraphLib.DepGraphData);
  expect(go).toThrow(/empty pkg/);
});

test('fromJSON pkg missing name field', async () => {
  const graphJson = {
    schemaVersion: '2.0.0',
    pkgManager: { name: 'pip' },
    pkgs: {
      'root': { name: 'app', version: '1.0.0' },
      'foo@2': { version: '2' },
    },
    graph: {
      'root': {
        pkgId: 'root',
        deps: [
          { nodeId: 'foo@2|x' },
        ],
      },
      'foo@2|x': {
        pkgId: 'foo@2',
        deps: [],
      },
    },
  };

  const go = () => depGraphLib.createFromJSON((graphJson as any) as depGraphLib.DepGraphData);
  expect(go).toThrow(/name/);
});

test('fromJSON a pkg missing version field', async () => {
  const graphJson = {
    schemaVersion: '2.0.0',
    pkgManager: { name: 'pip' },
    pkgs: {
      'root': { name: 'app', version: '1.0.0' },
      'foo@': { name: 'foo' },
    },
    graph: {
      'root': {
        pkgId: 'root',
        deps: [
          { nodeId: 'foo@|x' },
        ],
      },
      'foo@|x': {
        pkgId: 'foo@',
        deps: [],
      },
    },
  };

  const depGraph = depGraphLib.createFromJSON(graphJson as any);
  expect(depGraph.getPkgs().sort()).toEqual([
    { name: 'app', version: '1.0.0' },
    { name: 'foo', version: null },
  ]);
});

test('fromJSON pkg-id is not name@version of actual package', async () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '2.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: {
      'root': { name: 'app', version: '1.0.0' },
      'foo@3': { name: 'foo', version: '2' },
    },
    graph: {
      'root': {
        pkgId: 'root',
        deps: [
          { nodeId: 'foo@3|x' },
        ],
      },
      'foo@3|x': {
        pkgId: 'foo@3',
        deps: [],
      },
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/name/);
});
