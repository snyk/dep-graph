import * as _ from 'lodash';
import * as types from './types';

export {
  DepGraphImpl,
};

class DepGraphImpl implements types.DepGraphInternal {
  public static SCHEMA_VERSION = '2.0.0';

  private _pkgValues: types.PkgInfo[];
  private _pkgNodeIds: { [pkgId: string]: string[] } = {};
  private _nodeSuccessors: { [nodeId: string]: string[] } = {};
  private _nodePredecessors: { [nodeId: string]: string[] } = { root: []};
  private _hasCycles: boolean;

  public constructor(private data: types.DepGraphData) {
    this._pkgValues = _.values(data.pkgs);

    for (const [nodeId, node] of _.entries(data.graph)) {
      // node successors
      this._nodeSuccessors[nodeId] = node.deps.map((dep) => dep.nodeId);
      // node predecessors
      for (const dep of node.deps) {
        if (!this._nodePredecessors[dep.nodeId]) {
          this._nodePredecessors[dep.nodeId] = [];
        }
        this._nodePredecessors[dep.nodeId].push(nodeId);
      }
      // package nodes
      if (!this._pkgNodeIds[node.pkgId]) {
        this._pkgNodeIds[node.pkgId] = [];
      }
      this._pkgNodeIds[node.pkgId].push(nodeId);
    }
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
      return this._pkgNodeIds.root;
    }

    const pkgId = `${pkg.name}@${pkg.version || ''}`;
    if (!this.data.pkgs[pkgId]) {
      throw new Error(`no such pkg: ${pkgId}`);
    }
    return this._pkgNodeIds[pkgId];
  }

  public getNodeDepsNodeIds(nodeId: string): string[] {
    const deps = this._nodeSuccessors[nodeId];
    if (!deps) {
      throw new Error(`no such node: ${nodeId}`);
    }
    return deps;
  }

  public getNodeParentsNodeIds(nodeId: string): string[] {
    const parents = this._nodePredecessors[nodeId];
    if (!parents) {
      throw new Error(`no such node: ${nodeId}`);
    }
    return parents;
  }

  public hasCycles(): boolean {
    if (this._hasCycles !== undefined) {
      return this._hasCycles;
    }
    const graph = this.data.graph;
    const sanctified: Set<string> = new Set();
    function check(nodeId: string, predecessors: string[] = []): boolean {
      const node = graph[nodeId];
      for (const {nodeId: depNodeId} of node.deps) {
        if (sanctified.has(depNodeId)) { return false; }
        if (predecessors.indexOf(depNodeId) >= 0) { return true; }
        if (check(depNodeId, predecessors.concat(depNodeId))) { return true; }
        sanctified.add(depNodeId);
      }
      return false;
    }
    this._hasCycles = check('root');
    return this._hasCycles;
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
}
