import { DepGraph, DepGraphData, PkgInfo } from '..';
import { GraphNode } from '../core/types';

type PkgId = string;
export type NodeId = string;
export type EdgesMap = Map<NodeId, NodeId[]>;
type NodesMap = Map<NodeId, GraphNode>;
type PkgsInfoMap = Map<PkgId, PkgInfo>;

type GraphMaps = {
  nodesMap: NodesMap;
  edgesMap: EdgesMap;
  pkgsInfoMap: PkgsInfoMap;
};

export function getGraphMaps(depGraph: DepGraph): GraphMaps {
  const depGraphData: DepGraphData = depGraph.toJSON();
  const nodes: GraphNode[] = depGraphData.graph.nodes;

  const nodesMap = nodes.reduce(
    (map, graphNode) => map.set(graphNode.nodeId, graphNode),
    new Map() as NodesMap,
  );

  const edgesMap = nodes.reduce(
    (map, graphNode) =>
      map.set(
        graphNode.nodeId,
        graphNode.deps.map((y) => y.nodeId),
      ),
    new Map() as EdgesMap,
  );

  const pkgsInfoMap = depGraphData.pkgs.reduce(
    (map, pkgInfo) => map.set(pkgInfo.id, pkgInfo.info),
    new Map() as PkgsInfoMap,
  );

  return { nodesMap, edgesMap, pkgsInfoMap };
}
