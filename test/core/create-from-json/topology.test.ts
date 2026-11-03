import * as depGraphLib from '../../../src';

import * as helpers from '../../helpers';

test('fromJSON with a cycle', () => {
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
          deps: [{ nodeId: 'foo@2|x' }],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [{ nodeId: 'bar@3|x' }],
        },
        {
          nodeId: 'bar@3|x',
          pkgId: 'bar@3',
          deps: [{ nodeId: 'baz@4|x' }],
        },
        {
          nodeId: 'baz@4|x',
          pkgId: 'baz@4',
          deps: [{ nodeId: 'foo@2|x' }],
        },
      ],
    },
  };

  const depGraph = depGraphLib.createFromJSON(graphJson);

  helpers.expectSamePkgs(depGraph.getPkgs(), [
    { name: 'toor', version: '1.0.0' },
    { name: 'foo', version: '2' },
    { name: 'bar', version: '3' },
    { name: 'baz', version: '4' },
  ]);
  helpers.expectSamePkgs(depGraph.getDepPkgs(), [
    { name: 'foo', version: '2' },
    { name: 'bar', version: '3' },
    { name: 'baz', version: '4' },
  ]);

  const barPathsToRoot = depGraph.pkgPathsToRoot({ name: 'bar', version: '3' });
  expect(barPathsToRoot).toEqual([
    [
      { name: 'bar', version: '3' },
      { name: 'foo', version: '2' },
      { name: 'toor', version: '1.0.0' },
    ],
  ]);
  expect(depGraph.countPathsToRoot({ name: 'bar', version: '3' })).toBe(1);

  const fooPathsToRoot = depGraph.pkgPathsToRoot({ name: 'foo', version: '2' });
  expect(fooPathsToRoot).toEqual([
    [
      { name: 'foo', version: '2' },
      { name: 'toor', version: '1.0.0' },
    ],
  ]);
  expect(depGraph.countPathsToRoot({ name: 'foo', version: '2' })).toBe(1);
});

test('fromJSON root is not really root', () => {
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
          deps: [{ nodeId: 'foo@2|x' }],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
        {
          nodeId: 'bar@3|x',
          pkgId: 'bar@3',
          deps: [{ nodeId: 'toor' }],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/root/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON a pkg is not reachable from root', () => {
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
          deps: [{ nodeId: 'foo@2|x' }],
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

test('fromJSON root is not really root', () => {
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
          deps: [{ nodeId: 'foo@2|x' }],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [],
        },
        {
          nodeId: 'bar@3|x',
          pkgId: 'bar@3',
          deps: [{ nodeId: 'root' }],
        },
      ],
    },
  };

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/root/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON a pkg without an instance', () => {
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

  const go = () => depGraphLib.createFromJSON(graphJson);
  expect(go).toThrow(/instance/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON an instance without a pkg', () => {
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
          deps: [{ nodeId: 'foo@2|x' }],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [{ nodeId: 'bar@3|x' }],
        },
        {
          nodeId: 'bar@3|x',
          deps: [],
        },
      ],
    },
  };

  const go = () =>
    depGraphLib.createFromJSON(graphJson as any as depGraphLib.DepGraphData);
  expect(go).toThrow(/instance/);
  expect(go).toThrow(depGraphLib.Errors.ValidationError);
});

test('fromJSON an instance points to non-existing pkgId', () => {
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
          deps: [{ nodeId: 'foo@2|x' }],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [{ nodeId: 'bar@3|x' }],
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

test('fromJSON root has several instances', () => {
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
          deps: [{ nodeId: 'foo@2|x' }],
        },
        {
          nodeId: 'foo@2|x',
          pkgId: 'foo@2',
          deps: [{ nodeId: 'bar@3|x' }],
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
  helpers.expectSamePkgs(
    depGraph.getPkgs(),
    [
      { name: 'toor', version: '1.0.0' },
      { name: 'foo', version: '2' },
    ].sort(),
  );
  helpers.expectSamePkgs(
    depGraph.getDepPkgs(),
    [{ name: 'foo', version: '2' }].sort(),
  );
  expect(depGraph.countPathsToRoot({ name: 'toor', version: '1.0.0' })).toBe(2);
});
