// using .ts instead of .d.ts for this file,
//   as otherwise it's referenced from the auto-generated `index.d.ts`,
//   but not copied over to the `./dist` folder
//   and thus fails the compilation of a typescript project that imports this lib

export interface Pkg {
  name: string;
  version?: string;
}

export interface PkgInfo {
  name: string;
  version?: string;
  // NOTE: consider adding in the future
  // requires?: {
  //   name: string;
  //   versionRange: string;
  //   dev?: boolean;
  //   exclusions?: string[];
  // }[];
  // resolved?: {
  //   registry: string;
  //   url: string;
  // };
  // parentManifestUri?: string;
  // issues?: {
  //   id: string;
  //   type: string;
  //   title: string;
  //   severity: string;
  // }[];
}

export interface VersionProvenance {
  type: string;
  location: string;
  property?: {
    name: string;
  };
}

export interface NodeInfo {
  versionProvenance?: VersionProvenance;
  labels?: {
    [key: string]: string;
  };
}

export interface GraphNode {
  nodeId: string;
  pkgId: string;
  info?: NodeInfo;
  deps: Array<{
    nodeId: string;
    // NOTE: consider adding later:
    // meta?: JsonMap;
  }>;
}

export interface PkgManager {
  name: string;
  version?: string;
  repositories?: Array<{
    alias: string;
  }>;
}

export interface DepGraphData {
  schemaVersion: string;
  pkgManager: PkgManager;
  pkgs: Array<{
    id: string;
    info: PkgInfo;
  }>;
  graph: {
    rootNodeId: string;
    nodes: GraphNode[];
  };
}

export interface DepGraph {
  readonly pkgManager: PkgManager;
  readonly rootPkg: PkgInfo;
  getPkgs(): PkgInfo[];
  toJSON(): DepGraphData;
  pkgPathsToRoot(pkg: Pkg): PkgInfo[][];
  countPathsToRoot(pkg: Pkg): number;
}

// NOTE/TODO(shaun): deferring any/all design decisions here
// Revisit when we actually start using things
export interface DepGraphInternal extends DepGraph {
  readonly rootNodeId: string;
  getNode(nodeId: string): NodeInfo;
  getNodePkg(nodeId: string): PkgInfo;
  getPkgNodeIds(pkg: Pkg): string[];
  getNodeDepsNodeIds(nodeId: string): string[];
  getNodeParentsNodeIds(nodeId: string): string[];
  hasCycles(): boolean;
}
