import * as _ from 'lodash';
import * as graphlib from 'graphlib';
import * as types from './types';

export {
  DepGraphImpl,
};

class DepGraphImpl implements types.DepGraphInternal {
  public static SCHEMA_VERSION = '2.0.0';

  private _graphInstance: graphlib.Graph;
  private _pkgValues: types.PkgInfo[];
  private _pkgNodeIds: { [pkgId: string]: Set<string> };

  public constructor(private data: types.DepGraphData) {
    this._pkgValues = _.values(data.pkgs);
  }

  get pkgManager() {
    return this.data.pkgManager;
  }

  get rootPkg(): types.PkgInfo {
    return this.data.pkgs.root;
  }

  public getPkgs(): types.PkgInfo[] {
    return this._pkgValues;
  }

  public getNodePkg(nodeId: string): types.PkgInfo {
    const node = this.data.graph[nodeId];
    if (!node) {
      throw new Error(`no such node: ${nodeId}`);
    }
    return this.data.pkgs[node.pkgId];
  }

  public getPkgNodeIds(pkg: types.Pkg): string[] {
    if (pkg === this.rootPkg ||
      (pkg.name === this.rootPkg.name && pkg.version === this.rootPkg.version)) {
      return Array.from(this.pkgNodeIds.root);
    }

    const pkgId = `${pkg.name}@${pkg.version || ''}`;
    if (!this.data.pkgs[pkgId]) {
      throw new Error(`no such pkg: ${pkgId}`);
    }

    return Array.from(this.pkgNodeIds[pkgId]);
  }

  public getNodeDepsNodeIds(nodeId: string): string[] {
    const deps = this.graphInstance.successors(nodeId);
    if (!deps) {
      throw new Error(`no such node: ${nodeId}`);
    }
    return deps;
  }

  public getNodeParentsNodeIds(nodeId: string): string[] {
    const parents = this.graphInstance.predecessors(nodeId);
    if (!parents) {
      throw new Error(`no such node: ${nodeId}`);
    }
    return parents;
  }

  public hasCycles(): boolean {
    return !graphlib.alg.isAcyclic(this.graphInstance);
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
    return this.data;
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

  private get pkgNodeIds(): { [pkgId: string]: Set<string> } {
    if (this._pkgNodeIds) {
      return this._pkgNodeIds;
    }
    const pkgNodes: { [pkgId: string]: Set<string> } = {};
    for (const nodeId of Object.keys(this.data.graph)) {
      const node = this.data.graph[nodeId];
      const pkgId = node.pkgId;
      if (!pkgNodes[pkgId]) {
        pkgNodes[pkgId] = new Set();
      }
      pkgNodes[pkgId].add(nodeId);
    }
    this._pkgNodeIds = pkgNodes;
    return pkgNodes;
  }

  private get graphInstance(): graphlib.Graph {
    if (this._graphInstance) {
      return this._graphInstance;
    }
    const graph = new graphlib.Graph({
      directed: true,
      multigraph: false,
      compound: false,
    });
    // const pkgs = {};

    // for (const pkgId of Object.keys(this.data.pkgs)) {
    //   const pkg = this.data.pkgs[pkgId];
    //   pkgs[pkgId] = pkg.version ? pkg : { ...pkg, version: null };
    // }

    for (const nodeId of Object.keys(this.data.graph)) {
      const node = this.data.graph[nodeId];
      graph.setNode(nodeId, { pkgId: node.pkgId });
    }

    for (const nodeId of Object.keys(this.data.graph)) {
      const node = this.data.graph[nodeId];
      for (const depNodeId of node.deps) {
        graph.setEdge(nodeId, depNodeId.nodeId);
      }
    }

    this._graphInstance = graph;
    return graph;
  }
}
