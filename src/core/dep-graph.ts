import * as _ from 'lodash';
import * as graphlib from 'graphlib';
import * as types from './types';

export {
  DepGraphImpl,
};

interface Node {
  pkgId: string;
  info?: types.NodeInfo;
}

class DepGraphImpl implements types.DepGraphInternal {
  public static SCHEMA_VERSION = '1.1.0';

  public static getPkgId(pkg: types.Pkg): string {
    return `${pkg.name}@${pkg.version || ''}`;
  }

  private _pkgs: { [pkgId: string]: types.PkgInfo };
  private _pkgNodes: { [pkgId: string]: Set<string> };

  private _pkgList: types.PkgInfo[];

  private _graph: graphlib.Graph;
  private _pkgManager: types.PkgManager;

  private _rootNodeId: string;
  private _rootPkgId: string;

  private _countNodePathsToRootCache: Map<string, number> = new Map();

  public constructor(
    graph: graphlib.Graph,
    rootNodeId: string,
    pkgs: { [pkgId: string]: types.PkgInfo },
    pkgNodes: { [pkgId: string]: Set<string> },
    pkgManager: types.PkgManager,
  ) {
    this._graph = graph;
    this._pkgs = pkgs;
    this._pkgNodes = pkgNodes;
    this._pkgManager = pkgManager;

    this._rootNodeId = rootNodeId;
    this._rootPkgId = (graph.node(rootNodeId) as Node).pkgId;

    this._pkgList = _.values(pkgs);
  }

  get pkgManager() {
    return this._pkgManager;
  }

  get rootPkg(): types.PkgInfo {
    return this._pkgs[this._rootPkgId];
  }

  get rootNodeId(): string {
    return this._rootNodeId;
  }

  public getPkgs(): types.PkgInfo[] {
    return this._pkgList;
  }

  public getNode(nodeId: string): types.NodeInfo {
    return this.getGraphNode(nodeId).info || {};
  }

  public getNodePkg(nodeId: string): types.PkgInfo {
    return this._pkgs[this.getGraphNode(nodeId).pkgId];
  }

  public getPkgNodeIds(pkg: types.Pkg): string[] {
    const pkgId = DepGraphImpl.getPkgId(pkg);

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
    for (const id of this.getPkgNodeIds(pkg)) {
      pathsToRoot.push(...this.pathsFromNodeToRoot(id));
    }
    // note: sorting to get shorter paths first -
    //  it's nicer - and better resembles older behaviour
    return pathsToRoot.sort((a, b) => a.length - b.length);
  }

  public countPathsToRoot(pkg: types.Pkg): number {
    // TODO: implement cycles support
    if (this.hasCycles()) {
      throw new Error('countPathsToRoot does not support cyclic graphs yet');
    }

    let count = 0;
    for (const nodeId of this.getPkgNodeIds(pkg)) {
      count += this.countNodePathsToRoot(nodeId);
    }

    return count;
  }

  public toJSON(): types.DepGraphData {
    const nodeIds = this._graph.nodes();

    const nodes = nodeIds.reduce((acc: types.GraphNode[], nodeId: string) => {
      const deps = (this._graph.successors(nodeId) || [])
        .map((depNodeId) => ({ nodeId: depNodeId }));

      const node = this._graph.node(nodeId) as Node;
      const elem: types.GraphNode = {
        nodeId,
        pkgId: node.pkgId,
        deps,
      };
      if (!_.isEmpty(node.info)) {
        elem.info = node.info;
      }
      acc.push(elem);
      return acc;
    }, []);

    const pkgs: Array<{ id: string; info: types.PkgInfo; }> = _.keys(this._pkgs)
      .map((pkgId: string) => ({
        id: pkgId,
        info: this._pkgs[pkgId],
      }));

    return {
      schemaVersion: DepGraphImpl.SCHEMA_VERSION,
      pkgManager: this._pkgManager,
      pkgs,
      graph: {
        rootNodeId: this._rootNodeId,
        nodes,
      },
    };
  }

  private getGraphNode(nodeId: string): Node {
    const node = this._graph.node(nodeId) as Node;
    if (!node) {
      throw new Error(`no such node: ${nodeId}`);
    }
    return node;
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

  private countNodePathsToRoot(nodeId: string): number {
    if (this._countNodePathsToRootCache.has(nodeId)) {
      return this._countNodePathsToRootCache.get(nodeId) || 0;
    }

    const parentNodesIds = this.getNodeParentsNodeIds(nodeId);
    if (parentNodesIds.length === 0) {
      this._countNodePathsToRootCache.set(nodeId, 1);
      return 1;
    }

    const count = parentNodesIds.reduce((acc, parentNodeId) => {
      return acc + this.countNodePathsToRoot(parentNodeId);
    }, 0);

    this._countNodePathsToRootCache.set(nodeId, count);
    return count;
  }
}
