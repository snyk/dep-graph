import { DepGraph, DepGraphBuilder, PkgInfo } from '..';
import { DepGraphInternal, NodeInfo } from './types';

type NodeId = string;

export function pruneGraph(baseDepGraph: DepGraph): DepGraph {
  const depGraph = baseDepGraph as DepGraphInternal;

  const depGraphBuilder = new DepGraphBuilder(
    depGraph.pkgManager,
    depGraph.rootPkg,
    depGraph.rootNodeId,
  );

  dfsBuildGraph(depGraph.rootNodeId, depGraph, depGraphBuilder);

  return depGraphBuilder.build();
}

function dfsBuildGraph(
  nodeId: NodeId,
  depGraph: DepGraphInternal,
  depGraphBuilder: DepGraphBuilder,
  ancestors: NodeId[] = [],
  deduplicationSet: Set<NodeId> | undefined = undefined,
): void {
  const parentNodeId = ancestors[ancestors.length - 1];
  const pkgInfo: PkgInfo = depGraph.getNodePkg(nodeId);
  let nodeInfo: NodeInfo | undefined = depGraph.getNode(nodeId);
  let dependencies = depGraph.getNodeDepsNodeIds(nodeId);
  if (isEmpty(nodeInfo)) nodeInfo = undefined;

  if (ancestors.includes(nodeId)) {
    depGraphBuilder.connectDep(parentNodeId, nodeId);
    return;
  }

  if (deduplicationSet?.has(nodeId)) {
    nodeId = `${nodeId}_pruned`;
    nodeInfo = {
      ...(nodeInfo || {}),
      labels: {
        ...(nodeInfo?.labels || {}),
        pruned: 'true',
      },
    };
    dependencies = [];
  }
  deduplicationSet?.add(nodeId);

  if (parentNodeId) {
    depGraphBuilder.addPkgNode(pkgInfo, nodeId, nodeInfo);
    depGraphBuilder.connectDep(parentNodeId, nodeId);
  }

  for (const dep of dependencies) {
    dfsBuildGraph(
      dep,
      depGraph,
      depGraphBuilder,
      ancestors.concat(nodeId),
      deduplicationSet || new Set(),
    );
  }
}

function isEmpty(nodeInfo: NodeInfo) {
  return Object.keys(nodeInfo).length === 0;
}
