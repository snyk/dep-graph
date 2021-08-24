import { DepGraph, DepGraphInternal, NodeInfo, PkgInfo } from './types';
import { DepGraphBuilder } from './builder';

type NodeId = string;
type PkgName = string;

export async function filterPackagesFromGraph(
  originalDepGraph: DepGraph,
  packagesToFilterOut: (PkgName | PkgInfo)[],
): Promise<DepGraph> {
  if (!packagesToFilterOut?.length) return originalDepGraph;

  const depGraph = originalDepGraph as DepGraphInternal;

  const packages = depGraph
    .getDepPkgs()
    .filter((existingPkg) =>
      packagesToFilterOut.some((pkgToFilter) =>
        isString(pkgToFilter)
          ? existingPkg.name === pkgToFilter
          : existingPkg.name === pkgToFilter.name &&
            existingPkg.version === pkgToFilter.version,
      ),
    );

  const nodeIdsToFilterOut: NodeId[] = [];
  for (const pkg of packages) {
    const nodeIds = depGraph.getPkgNodeIds(pkg);
    for (const nodeId of nodeIds) {
      nodeIdsToFilterOut.push(nodeId);
    }
  }

  return filterNodesFromGraph(originalDepGraph, nodeIdsToFilterOut);
}

export async function filterNodesFromGraph(
  originalDepGraph: DepGraph,
  nodeIdsToFilterOut: NodeId[],
): Promise<DepGraph> {
  if (!nodeIdsToFilterOut?.length) return originalDepGraph;

  const depGraph = originalDepGraph as DepGraphInternal;
  const existingNodeIds: Set<NodeId> = new Set(depGraph['_graph'].nodes());
  nodeIdsToFilterOut = nodeIdsToFilterOut.filter((nodeId) =>
    existingNodeIds.has(nodeId),
  );
  if (nodeIdsToFilterOut.length === 0) return originalDepGraph;

  const depGraphBuilder = new DepGraphBuilder(
    depGraph.pkgManager,
    depGraph.rootPkg,
  );

  const nodeIdsToFilterOutSet = new Set(nodeIdsToFilterOut);

  const queue: [NodeId, NodeId?][] = [[depGraph.rootNodeId, undefined]];

  while (queue.length > 0) {
    const [nodeId, parentNodeId] = queue.pop()!;

    if (nodeIdsToFilterOutSet.has(nodeId)) continue;

    if (parentNodeId) {
      const pkgInfo = depGraph.getNodePkg(nodeId);
      let nodeInfo: NodeInfo | undefined = depGraph.getNode(nodeId);
      if (isEmpty(nodeInfo)) nodeInfo = undefined;

      depGraphBuilder.addPkgNode(pkgInfo, nodeId, nodeInfo);
      depGraphBuilder.connectDep(parentNodeId, nodeId);
    }

    const dependencies = depGraph.getNodeDepsNodeIds(nodeId).slice().reverse();

    for (const depNodeId of dependencies) {
      queue.push([depNodeId, nodeId]);
    }
  }

  return depGraphBuilder.build();
}

function isString(pkgToFilter: string | PkgInfo): pkgToFilter is string {
  return typeof pkgToFilter === 'string';
}

function isEmpty(obj) {
  return !obj || Object.keys(obj).length === 0;
}
