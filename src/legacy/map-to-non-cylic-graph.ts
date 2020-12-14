import { DepGraph, DepGraphBuilder, PkgInfo } from '..';
import { DepGraphInternal, NodeInfo } from '../core/types';
import { EventLoopSpinner } from './event-loop-spinner';

type NodeId = string;

export async function mapToNonCyclicGraph(
  depGraphToMap: DepGraph,
): Promise<DepGraph> {
  const depGraph = depGraphToMap as DepGraphInternal;
  if (!depGraph.hasCycles()) {
    return depGraph;
  }

  const depGraphBuilder = new DepGraphBuilder(
    depGraph.pkgManager,
    depGraph.rootPkg,
    depGraph.rootNodeId
  );

  const eventLoopSpinner = new EventLoopSpinner();

  await dfsBuildGraph(
    depGraph.rootNodeId,
    depGraph,
    depGraphBuilder,
    eventLoopSpinner,
  );

  return depGraphBuilder.build();
}

async function dfsBuildGraph(
  nodeId: NodeId,
  depGraph: DepGraphInternal,
  depGraphBuilder: DepGraphBuilder,
  eventLoopSpinner: EventLoopSpinner,
  ancestors: NodeId[] = [],
  memoizationSet: Set<NodeId> = new Set(),
): Promise<void> {
  const parentNodeId = ancestors[ancestors.length - 1];
  const pkgInfo: PkgInfo = depGraph.getNodePkg(nodeId);
  let nodeInfo: NodeInfo = depGraph.getNode(nodeId);
  let dependencies = depGraph.getNodeDepsNodeIds(nodeId);

  if (ancestors.includes(nodeId)) {
    nodeId = `${nodeId}_pruned`;
    nodeInfo = {
      ...(nodeInfo || {}),
      labels: {
        ...(nodeInfo.labels || {}),
        pruned: 'cyclic',
      },
    };
    dependencies = [];
  } else if (memoizationSet.has(nodeId)) {
    dependencies = [];
  }

  if (parentNodeId) {
    depGraphBuilder.addPkgNode(pkgInfo, nodeId, nodeInfo);
    depGraphBuilder.connectDep(parentNodeId, nodeId);
  }

  for (const dep of dependencies) {
    await dfsBuildGraph(
      dep,
      depGraph,
      depGraphBuilder,
      eventLoopSpinner,
      ancestors.concat(nodeId),
      memoizationSet
    );
  }

  memoizationSet.add(nodeId);
  if (eventLoopSpinner.isStarving()) {
    await eventLoopSpinner.spin();
  }
}
