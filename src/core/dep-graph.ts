import * as _ from 'lodash';
import * as graphlib from 'graphlib';
import * as types from './types';

export {
  DepGraphImpl,
};

class DepGraphImpl implements types.DepGraphInternal {
  public static SCHEMA_VERSION = '2.0.0';

  private _pkgs: {
    root: types.PkgInfo;
    [pkgId: string]: types.PkgInfo;
  };

  private _pkgNodes: { [pkgId: string]: Set<string> };

  private _pkgList: types.PkgInfo[];

  private _graph: graphlib.Graph;
  private _pkgManager: types.PkgManager;

  public constructor(
    graph: graphlib.Graph,
    pkgs: {
      root: types.PkgInfo;
      [pkgId: string]: types.PkgInfo;
    },
    pkgNodes: { [pkgId: string]: Set<string> },
    pkgManager: types.PkgManager,
  ) {
    this._graph = graph;
    this._pkgs = pkgs;
    this._pkgNodes = pkgNodes;
    this._pkgManager = pkgManager;

    this._pkgList = _.values(pkgs);
  }

  get pkgManager() {
    return this._pkgManager;
  }

  get rootPkg(): types.PkgInfo {
    return this._pkgs.root;
  }

  public getPkgs(): types.PkgInfo[] {
    return this._pkgList;
  }

  public getNodePkg(nodeId: string): types.PkgInfo {
    const node = this._graph.node(nodeId);
    if (!node) {
      throw new Error(`no such node: ${nodeId}`);
    }

    return this._pkgs[node.pkgId];
  }

  public getPkgNodeIds(pkg: types.Pkg): string[] {
    if (pkg === this.rootPkg ||
      (pkg.name === this.rootPkg.name && pkg.version === this.rootPkg.version)) {
      return Array.from(this._pkgNodes.root);
    }

    const pkgId = `${pkg.name}@${pkg.version || ''}`;
    if (!this._pkgs[pkgId]) {
      throw new Error(`no such pkg: ${pkgId}`);
    }

    return Array.from(this._pkgNodes[pkgId]);
  }

  public getNodeDepsNodeIds(nodeId: string): string[] {
    const deps = this._graph.successors(nodeId);
    if (!deps) {
      throw new Error(`no such node: ${nodeId}`);
    }
    return deps;
  }

  public getNodeParentsNodeIds(nodeId: string): string[] {
    const parents = this._graph.predecessors(nodeId);
    if (!parents) {
      throw new Error(`no such node: ${nodeId}`);
    }
    return parents;
  }

  public hasCycles(): boolean {
    return !graphlib.alg.isAcyclic(this._graph);
  }

  public pkgPathsToRoot(pkg: types.Pkg): types.PkgInfo[][] {
    // TODO: implement cycles support
    if (this.hasCycles()) {
      throw new Error('pkgPathsToRoot does not support cyclic graphs yet');
    }

    const pathsToRoot: types.PkgInfo[][] = [];

    const nodeIds = this.getPkgNodeIds(pkg);
    if (nodeIds) {
      for (const id of nodeIds) {
        pathsToRoot.push(...this.pathsFromNodeToRoot(id));
      }
    }
    // note: sorting to get shorter paths first -
    //  it's nicer - and better resembles older behaviour
    return pathsToRoot.sort((a, b) => a.length - b.length);
  }

  public toJSON(): types.DepGraphData {
    const nodeIds = this._graph.nodes();

    const graph = nodeIds.reduce((acc, nodeId: string) => {
      const deps = (this._graph.successors(nodeId) || [])
        .map((depNodeId) => ({ nodeId: depNodeId }));

      acc[nodeId] = {
        pkgId: this._graph.node(nodeId).pkgId,
        deps,
      };
      return acc;
    }, {});

    return {
      schemaVersion: DepGraphImpl.SCHEMA_VERSION,
      pkgManager: this._pkgManager,
      pkgs: this._pkgs,
      graph: graph as any,
    };
  }

  private pathsFromNodeToRoot(nodeId: string): types.PkgInfo[][] {
    const parentNodesIds = this.getNodeParentsNodeIds(nodeId);
    if (parentNodesIds.length === 0) {
      return [[this.getNodePkg(nodeId)]];
    }
    const allPaths: types.PkgInfo[][] = [];
    parentNodesIds.map((id) => {
      const out = this.pathsFromNodeToRoot(id).map((path) => {
        return [this.getNodePkg(nodeId)].concat(path);
      });
      allPaths.push(...out);
    });
    return allPaths;
  }

}
