import * as graphlib from 'graphlib';
import * as types from './types';
import { DepGraphImpl } from './dep-graph';

export {
  DepGraphBuilder,
};

class DepGraphBuilder {
  private _pkgs: {
    root: types.PkgInfo;
    [pkgId: string]: types.PkgInfo;
  };
  private _pkgNodes: { [pkgId: string]: Set<string> } = {};

  private _graph: graphlib.Graph;
  private _pkgManager: types.PkgManager;

  public constructor(pkgManager: types.PkgManager, rootPkg?: types.PkgInfo) {
    const graph = new graphlib.Graph({
      directed: true,
      multigraph: false,
      compound: false,
    });

    this._pkgs = {
      root: rootPkg || {
        name: '_root',
        version: '0.0.0',
      },
    };

    graph.setNode('root', { pkgId: 'root' });
    this._pkgNodes.root = new Set(['root']);
    this._graph = graph;
    this._pkgManager = pkgManager;
  }

  // TODO: this can create disconnected nodes
  public addPkgNode(pkgInfo: types.PkgInfo, nodeId: string) {
    if (nodeId === 'root') {
      throw new Error('DepGraphBuilder.addPkgNode() cant override root node');
    }

    const pkgId = `${pkgInfo.name}@${pkgInfo.version || ''}`;

    this._pkgs[pkgId] = pkgInfo;
    this._pkgNodes[pkgId] = this._pkgNodes[pkgId] || new Set();
    this._pkgNodes[pkgId].add(nodeId);

    this._graph.setNode(nodeId, { pkgId });
  }

  // TODO: this can create cycles
  public connectDep(parentNodeId: string, depNodeId: string) {
    if (!this._graph.hasNode(parentNodeId)) {
      throw new Error('parentNodeId does not exist');
    }

    if (!this._graph.hasNode(depNodeId)) {
      throw new Error('depNodeId does not exist');
    }

    this._graph.setEdge(parentNodeId, depNodeId);
  }

  public build(): types.DepGraph {
    const nodeIds = this._graph.nodes();

    const nodes: any = nodeIds.reduce((acc, nodeId: string) => {
      const deps = (this._graph.successors(nodeId) || [])
        .map((depNodeId) => ({ nodeId: depNodeId }));

      acc[nodeId] = {
        pkgId: this._graph.node(nodeId).pkgId,
        deps,
      };
      return acc;
    }, {});

    return new DepGraphImpl({
      schemaVersion: '2.0.0',
      pkgManager: this._pkgManager,
      pkgs: this._pkgs,
      graph: nodes,
    });
  }
}
