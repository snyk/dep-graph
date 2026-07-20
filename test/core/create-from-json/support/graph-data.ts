import { DepGraphData } from '../../../../src';

type GraphNode = DepGraphData['graph']['nodes'][number];

export function getGraphNode(data: DepGraphData, nodeId: string): GraphNode {
  const node = data.graph.nodes.find(
    (candidate) => candidate.nodeId === nodeId,
  );
  if (!node) {
    throw new Error(`fixture node not found: ${nodeId}`);
  }
  return node;
}

export function createDiamondGraphData(): DepGraphData {
  return {
    schemaVersion: '1.0.0',
    pkgManager: {
      name: 'npm',
      version: '10.0.0',
      repositories: [{ alias: 'npmjs' }],
    },
    pkgs: [
      {
        id: 'root@1.0.0',
        info: {
          name: 'root',
          version: '1.0.0',
          purl: 'pkg:npm/root@1.0.0',
        },
      },
      {
        id: 'left@2.0.0',
        info: {
          name: 'left',
          version: '2.0.0',
          purl: 'pkg:npm/left@2.0.0',
        },
      },
      {
        id: 'right@3.0.0',
        info: {
          name: 'right',
          version: '3.0.0',
          purl: 'pkg:npm/right@3.0.0',
        },
      },
      {
        id: 'shared@4.0.0',
        info: {
          name: 'shared',
          version: '4.0.0',
          purl: 'pkg:npm/shared@4.0.0',
        },
      },
    ],
    graph: {
      rootNodeId: 'root-node',
      nodes: [
        {
          nodeId: 'root-node',
          pkgId: 'root@1.0.0',
          info: {
            labels: { scope: 'prod', source: 'manifest' },
          },
          deps: [{ nodeId: 'left-node' }, { nodeId: 'right-node' }],
        },
        {
          nodeId: 'left-node',
          pkgId: 'left@2.0.0',
          info: {
            versionProvenance: {
              type: 'lock-file',
              location: 'package-lock.json',
              property: { name: 'left' },
            },
          },
          deps: [{ nodeId: 'shared-node' }],
        },
        {
          nodeId: 'right-node',
          pkgId: 'right@3.0.0',
          info: {
            labels: { scope: 'dev', pruned: 'true' },
          },
          deps: [{ nodeId: 'shared-node' }],
        },
        {
          nodeId: 'shared-node',
          pkgId: 'shared@4.0.0',
          deps: [],
        },
      ],
    },
  };
}
