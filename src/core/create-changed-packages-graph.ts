import { DepGraph, DepGraphInternal, NodeInfo, PkgInfo } from './types';
import { DepGraphImpl } from './dep-graph';
import { DepGraphBuilder } from './builder';
import { eventLoopSpinner } from 'event-loop-spinner';

type NodeId = string;

/**
 * Creates an induced subgraph of  {@param graphB} with only packages
 * that are not present in {@param graphA} or have a different version.
 *
 * @param graphA
 * @param graphB
 */
export async function createChangedPackagesGraph(
  graphA: DepGraph,
  graphB: DepGraph,
): Promise<DepGraph> {
  const depGraph = graphB as DepGraphInternal;

  const graphAPackageIds = new Set(
    graphA.getDepPkgs().map(DepGraphImpl.getPkgId),
  );

  const addedOrUpdatedPackages: PkgInfo[] = depGraph
    .getDepPkgs()
    .filter((pkg) => !graphAPackageIds.has(DepGraphImpl.getPkgId(pkg)));

  const depGraphBuilder = new DepGraphBuilder(
    depGraph.pkgManager,
    depGraph.rootPkg,
  );

  const parentQueue: [parentId: NodeId, nodeId: NodeId][] = [];
  for (const changedPackage of addedOrUpdatedPackages) {
    for (const changedNodeId of depGraph.getPkgNodeIds(changedPackage)) {
      //we add all nodes with new and changed packages to the new graph.
      //a newly added node will also have its dependencies added here, since they are "new".
      depGraphBuilder.addPkgNode(
        depGraph.getNodePkg(changedNodeId),
        changedNodeId,
        getNodeInfo(depGraph, changedNodeId),
      );

      //Push all direct parents of the changed nodes to a queue to later build up a path to root from that node
      for (const parentId of depGraph.getNodeParentsNodeIds(changedNodeId)) {
        parentQueue.push([parentId, changedNodeId]);

        if (eventLoopSpinner.isStarving()) {
          await eventLoopSpinner.spin();
        }
      }
    }
  }

  //add direct and transitive parents for the changed nodes
  const visited = new Set([depGraph.rootNodeId]);

  while (parentQueue.length > 0) {
    const [nodeId, dependencyNodeId] = parentQueue.pop()!;
    if (visited.has(nodeId)) {
      //ensure we link parents even if visited through another path
      depGraphBuilder.connectDep(nodeId, dependencyNodeId);
      continue;
    }

    visited.add(nodeId);

    depGraphBuilder.addPkgNode(
      depGraph.getNodePkg(nodeId),
      nodeId,
      getNodeInfo(depGraph, nodeId),
    );
    depGraphBuilder.connectDep(nodeId, dependencyNodeId);

    for (const parentId of depGraph.getNodeParentsNodeIds(nodeId)) {
      parentQueue.push([parentId, nodeId]);

      if (eventLoopSpinner.isStarving()) {
        await eventLoopSpinner.spin();
      }
    }
  }

  return depGraphBuilder.build();
}

function getNodeInfo(
  depGraph: DepGraphInternal,
  nodeId: string,
): NodeInfo | undefined {
  const nodeInfo: NodeInfo = depGraph.getNode(nodeId);
  if (!nodeInfo || Object.keys(nodeInfo).length === 0) {
    return undefined;
  }
  return nodeInfo;
}
