import * as depGraphLib from '../../../src';

import * as helpers from '../../helpers';

describe('fromJSON simple', () => {
  const simpleGraphJson = helpers.loadFixture('simple-graph.json');
  const graph = depGraphLib.createFromJSON(simpleGraphJson);

  test('basic properties', () => {
    expect(graph.pkgManager.name).toBe('maven');

    expect(graph.rootPkg).toEqual({
      name: 'root',
      version: '0.0.0',
    });
  });

  test('getPkgs()', () => {
    helpers.expectSamePkgs(graph.getPkgs(), [
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
      { name: 'c', version: '1.0.0' },
      { name: 'd', version: '0.0.1' },
      { name: 'd', version: '0.0.2' },
      { name: 'e', version: '5.0.0' },
      { name: 'root', version: '0.0.0' },
    ]);
  });

  test('getDepPkgs()', () => {
    helpers.expectSamePkgs(graph.getDepPkgs(), [
      { name: 'a', version: '1.0.0' },
      { name: 'b', version: '1.0.0' },
      { name: 'c', version: '1.0.0' },
      { name: 'd', version: '0.0.1' },
      { name: 'd', version: '0.0.2' },
      { name: 'e', version: '5.0.0' },
    ]);
  });

  test('getPathsToRoot', () => {
    expect(graph.pkgPathsToRoot({ name: 'd', version: '0.0.1' })).toHaveLength(
      1,
    );
    expect(graph.countPathsToRoot({ name: 'd', version: '0.0.1' })).toBe(1);

    expect(graph.pkgPathsToRoot({ name: 'd', version: '0.0.2' })).toHaveLength(
      1,
    );
    expect(graph.countPathsToRoot({ name: 'd', version: '0.0.2' })).toBe(1);

    expect(graph.pkgPathsToRoot({ name: 'c', version: '1.0.0' })).toHaveLength(
      2,
    );
    expect(graph.countPathsToRoot({ name: 'c', version: '1.0.0' })).toBe(2);

    expect(graph.pkgPathsToRoot({ name: 'e', version: '5.0.0' })).toHaveLength(
      2,
    );
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

  test('getPkgNodes', () => {
    expect(graph.getPkgNodes({ name: 'root', version: '0.0.0' })).toHaveLength(
      1,
    );
    expect(graph.getPkgNodes({ name: 'a', version: '1.0.0' })).toHaveLength(1);

    const cNodes = graph.getPkgNodes({ name: 'c', version: '1.0.0' });
    expect(cNodes).toHaveLength(2);
    expect(cNodes[0].info).toEqual(cNodes[1].info);

    expect(() =>
      graph.getPkgNodes({ name: 'no-such-pkg', version: '1.3.7' }),
    ).toThrow();
  });
});

test('fromJSON with pkgManager.repositories', () => {
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
          deps: [{ nodeId: 'foo@2|x' }],
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

test('fromJSON a pkg and a node share same id', () => {
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
          deps: [{ nodeId: 'foo@2' }],
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

  helpers.expectSamePkgs(
    depGraph.getPkgs(),
    [
      { name: 'toor', version: '1.0.0' },
      { name: 'foo', version: '2' },
    ].sort(),
  );
  helpers.expectSamePkgs(depGraph.getDepPkgs(), [
    { name: 'foo', version: '2' },
  ]);

  expect(depGraph.pkgPathsToRoot({ name: 'foo', version: '2' })).toEqual([
    [
      { name: 'foo', version: '2' },
      { name: 'toor', version: '1.0.0' },
    ],
  ]);
  expect(depGraph.countPathsToRoot({ name: 'foo', version: '2' })).toBe(1);
});

test('fromJSON no deps', () => {
  const graphJson: depGraphLib.DepGraphData = {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'pip',
    },
    pkgs: [{ id: 'toor@1.0.0', info: { name: 'toor', version: '1.0.0' } }],
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
  expect(depGraph.getDepPkgs()).toEqual([]);
  expect(depGraph.pkgManager.name).toEqual('pip');
});
