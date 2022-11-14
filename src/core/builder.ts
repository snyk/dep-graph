import * as graphlib from '../graphlib';
import * as types from './types';
import { DepGraphImpl } from './dep-graph';
import { validatePackageURL } from './validate-graph';

export { DepGraphBuilder };

class DepGraphBuilder {
  get rootNodeId(): string {
    return this._rootNodeId;
  }

  private static _getPkgId(pkg: types.Pkg): string {
    return `${pkg.name}@${pkg.version || ''}`;
  }

  private _pkgs: { [pkgId: string]: types.PkgInfo } = {};
  private _pkgNodes: { [pkgId: string]: Set<string> } = {};

  private _graph: graphlib.Graph;
  private _pkgManager: types.PkgManager;

  private _rootNodeId: string;
  private _rootPkgId: string;

  public constructor(pkgManager: types.PkgManager, rootPkg?: types.PkgInfo) {
    const graph = new graphlib.Graph({
      directed: true,
      multigraph: false,
      compound: false,
    });
    if (!rootPkg) {
      rootPkg = {
        name: '_root',
        version: '0.0.0',
      };
    }

    this._rootNodeId = 'root-node';
    this._rootPkgId = DepGraphBuilder._getPkgId(rootPkg);
    this._pkgs[this._rootPkgId] = rootPkg;

    graph.setNode(this._rootNodeId, { pkgId: this._rootPkgId });
    this._pkgNodes[this._rootPkgId] = new Set([this._rootNodeId]);

    this._graph = graph;
    this._pkgManager = pkgManager;
  }

  public getPkgs(): types.PkgInfo[] {
    return Object.values(this._pkgs);
  }

  // TODO: this can create disconnected nodes
  public addPkgNode(
    pkgInfo: types.PkgInfo,
    nodeId: string,
    nodeInfo?: types.NodeInfo,
  ) {
    if (nodeId === this._rootNodeId) {
      throw new Error('DepGraphBuilder.addPkgNode() cant override root node');
    }

    validatePackageURL(pkgInfo);

    const pkgId = DepGraphBuilder._getPkgId(pkgInfo);

    this._pkgs[pkgId] = pkgInfo;
    this._pkgNodes[pkgId] = this._pkgNodes[pkgId] || new Set();
    this._pkgNodes[pkgId].add(nodeId);

    this._graph.setNode(nodeId, { pkgId, info: nodeInfo });
    return this;
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
    return this;
  }

  public build(): types.DepGraph {
    return new DepGraphImpl(
      this._graph,
      this._rootNodeId,
      this._pkgs,
      this._pkgNodes,
      this._pkgManager,
    );
  }
}
