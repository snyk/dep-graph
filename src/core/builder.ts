import * as types from './types';
import { DepGraphImpl } from './dep-graph';
import { conditionalExpression } from '@babel/types';

export {
  DepGraphBuilder,
};

class DepGraphBuilder {

  get rootNodeId(): string {
    return this._data.rootNodeId;
  }

  private static _getPkgId(pkg: types.Pkg): string {
    return `${pkg.name}@${pkg.version || ''}`;
  }

  private _data: types.DepGraphData2;

  public constructor(pkgManager: types.PkgManager, rootPkg?: types.PkgInfo) {

    if (!rootPkg) {
      rootPkg = {
        name: '_root',
        version: '0.0.0',
      };
    }
    const rootPkgId = DepGraphBuilder._getPkgId(rootPkg);

    this._data = {
      pkgManager,
      schemaVersion: '2.0.0',
      rootNodeId: 'root-node',
      pkgs: {[rootPkgId]: rootPkg},
      nodes: {'root-node': {pkgId: rootPkgId, deps: {}}},
    };
  }

  // TODO: this can create disconnected nodes
  public addPkgNode(pkgInfo: types.PkgInfo, nodeId: string, nodeInfo?: types.NodeInfo) {
    if (nodeId === this._data.rootNodeId) {
      throw new Error('DepGraphBuilder.addPkgNode() cant override root node');
    }

    const pkgId = DepGraphBuilder._getPkgId(pkgInfo);

    this._data.pkgs[pkgId] = pkgInfo;

    if (!this._data.nodes[nodeId]) {
      this._data.nodes[nodeId] = { pkgId, deps: {} };
    }
    if (nodeInfo) {
      this._data.nodes[nodeId].info = nodeInfo;
    }
  }

  // TODO: this can create cycles
  public connectDep(parentNodeId: string, depNodeId: string) {
    if (!this._data.nodes[parentNodeId]) {
      throw new Error('parentNodeId does not exist');
    }

    if (!this._data.nodes[depNodeId]) {
      throw new Error('depNodeId does not exist');
    }

    this._data.nodes[parentNodeId].deps[depNodeId] = {};
  }

  public build(): types.DepGraph {
    return new DepGraphImpl(
      this._data,
    );
  }
}
